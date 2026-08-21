// 리포트 출고 검사.
//
// 프롬프트로 "단정 표현을 쓰지 마라"라고 적어두는 것과, 실제로 안 쓰였는지 확인하는 것은
// 다른 일이다. 여기서는 모델이 돌려준 리포트를 내보내기 전에 한 번 훑는다.
//
// 검사 결과는 두 갈래다.
//   blocking — 다시 시켜야 하는 것 (단정 예언, 의료·법률·금융 판정, 섹션 수 어긋남)
//   advisory — 기록만 남기는 것 (길이, 근거 누락 한두 건)
// 8000 토큰짜리 생성을 headline이 세 글자 길다고 다시 돌릴 이유는 없다.

import { slimFacts, type StructuredReport } from "@/lib/reading-prompt";
import { countMarks, stripMarks, totalMarks } from "@/lib/reading-marks";
import { coverageFindings, productCoverage } from "@/lib/reading-coverage";
import { THREE_XING_GROUP_LABELS, XING_GROUP_LABEL, xingLabel } from "@/lib/myeongri/xing-name";
import type { SajuFacts } from "@/lib/saju-facts";
import type { ReadingRule } from "@/lib/reading-rules";
import { checkAdvanced, ADVANCED_BLOCKING_CODES } from "@/lib/reading-guard-advanced";

export interface GuardViolation {
  kind: "단정" | "선넘음" | "구조" | "근거" | "용어" | "강조" | "명리" | "범위";
  /** 어디서 걸렸는지 — "sections[3].summary" */
  where: string;
  detail: string;
  blocking: boolean;
  /** 기계가 집계할 수 있는 코드. 명식을 받아야만 낼 수 있는 검사에만 붙는다. */
  code?: string;
}

export interface GuardResult {
  ok: boolean;
  /** 다시 시켜야 하는 위반이 있는가 — 모델이 고칠 수 있는 것 */
  mustRetry: boolean;
  /**
   * 사람이 봐야 하는가 — 다시 시켜도 안 고쳐지는 것.
   *
   * 12절이 규칙 넷 위에 서 있는 것은 모델의 잘못이 아니다. 몇 번을 다시 시켜도
   * 규칙은 넷이다. mustRetry 와 나눠 두지 않으면, 고쳐지지 않는 것을 붙잡고
   * 생성을 되풀이하거나 아니면 그냥 나가게 된다. 둘 다 나쁘다.
   */
  needsReview: boolean;
  violations: GuardViolation[];
}

/**
 * 유료 리포트로 나가면 안 되는 것.
 *
 * mustRetry 와 겹치되 같지 않다. 여기 있는 것은 "이 상태로는 팔지 않는다"의 목록이고,
 * 그중 일부(커버리지)는 다시 생성한다고 해결되지 않는다.
 */
export const DEPLOY_BLOCKING_CODES = new Set([
  ...ADVANCED_BLOCKING_CODES,
  "GUARD-NAMED-TERM-ABSENT",
  "GUARD-XING-OVERNAME",
  "GUARD-UNBUNDLED-RELATION-COUNT",
  "GUARD-UNSUPPORTED-PARTNER-CLAIM",
  "GUARD-TIMING-WINDOW-MISSING",
  "GUARD-FACT-PATH-MISMATCH",
  "GUARD-FACT-CHIP-UNUSED",
  "GUARD-RULE-NOT-MATCHED",
  "PRODUCT-LOW-RULE-COVERAGE",
  "PRODUCT-REPETITIVE-RULE",
]);

// 단정 예언 — 명리는 확정을 말하지 않는다.
// '운명'과 '재회'는 낱말 자체가 아니라 단정으로 쓰인 꼴만 잡는다.
//
// threads-guard.ts 가 같은 표를 쓴다. Threads 초안은 리포트와 구조가 전혀 다르지만
// 하면 안 되는 말은 같아서, 표를 두 벌 두면 한쪽만 고쳐지는 날이 온다.
export const ABSOLUTE_PATTERNS: [RegExp, string][] = [
  [/반드시/, "반드시"],
  [/무조건/, "무조건"],
  [/틀림없이/, "틀림없이"],
  [/100\s*%/, "100%"],
  // "확정적" 만으로는 잡지 않는다. 서술어가 되어야 단정이다 —
  // "먼저 확정적인 말을 하기 어려워요" 는 단정의 반대말인데도 걸리고 있었다.
  [/확정(이다|입니다|이에요|돼요|됩니다|적이다|적입니다|적이에요|적이야)/, "확정"],
  [/운명(이다|입니다|이에요|이야)/, "운명이다"],
  // 뒤에 '면·고·거나·든' 이 붙으면 가정이거나 인용이다. "재회한다면 달라져야 할 것" 은
  // 결과를 단정한 말이 아니라 조건을 세운 말이라, 이걸 잡으면 재회 상품이 매번 걸린다.
  [/(재회|이별|결혼)(한다(?![면고든]|거나)|합니다|해요|하게 된다(?![면고든]|거나)|하게 됩니다)/, "결과 단정"],
  // 헤어지다는 활용이 달라 위 묶음에 얹히지 않는다. "헤어한다" 같은 말은 없으므로
  // 여기 없으면 헤어지는 쪽 단정은 통째로 새 나간다.
  [/헤어(진다(?![면고든]|거나)|져요|집니다|지게 된다(?![면고든]|거나)|지게 됩니다)/, "결과 단정"],
  [/(반드시|꼭)\s*(올|옵니다|와요)/, "연락 단정"],
];

// 선을 넘는 판정 — 의료·법률·금융
export const OUT_OF_SCOPE: [RegExp, string][] = [
  [/(진단명|처방전|복용|투약)/, "의료 판정"],
  [/(고소|소송|고발|법적 조치)/, "법률 판정"],
  [/(투자|대출|주식|코인)\s*(하세요|해라|추천|권한다)/, "금융 지시"],
];

/** 제목은 상품 목차에서 그대로 내려온 문구라 검사에서 뺀다 (예: "다투게 된다면 반드시 이 지점에서") */
function scannableText(report: StructuredReport): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: "meta.headline", text: report.meta.headline },
  ];
  report.sections.forEach((section, index) => {
    out.push({ where: `sections[${index}].summary`, text: section.summary });
    section.paragraphs.forEach((paragraph, pIndex) => {
      out.push({ where: `sections[${index}].paragraphs[${pIndex}]`, text: paragraph });
    });
    if (section.watchOut) out.push({ where: `sections[${index}].watch_out`, text: section.watchOut });
  });
  // 카드는 티저로 가장 먼저 노출되는 글이다. 본문보다 덜 검사할 이유가 없는데
  // 여기 빠져 있어서, 괄호 설명 없는 고유명이 카드로 그대로 나갔다.
  report.summaryCards.forEach((card, index) => {
    out.push({ where: `summary_cards[${index}]`, text: `${card.value} ${card.detail}` });
  });
  report.actionQuestions.forEach((item, index) => {
    out.push({ where: `action_questions[${index}]`, text: `${item.question} ${item.whyItMatters}` });
  });
  if (report.characterNote) {
    out.push({ where: "character_note.message", text: report.characterNote.message });
  }
  return out.filter((item) => item.text);
}

export interface GuardOptions {
  /** 상품 목차의 항목 수 — 섹션은 이만큼 나와야 한다 */
  expectedSections: number;
  /** 매칭된 해석 규칙이 금지한 문구 */
  forbiddenClaims?: string[];
  /**
   * 이 리포트가 나온 명식.
   *
   * 없으면 표현 검사만 돈다 — 그것이 오래 이 가드가 하던 전부였고, 그래서
   * "명식에 없는 글자를 이름으로 부르는" 문제를 한 번도 못 잡았다. checkReport 는
   * 리포트만 보고 있었으므로 명리적으로 틀렸는지 알 길이 아예 없었다.
   */
  facts?: SajuFacts;
  partnerFacts?: SajuFacts | null;
  /** 이 명식·이 상품에서 켜진 검수 규칙 */
  matchedRules?: ReadingRule[];
  /** 상품 id — 규칙 커버리지를 상품 단위로 센다 */
  productDomain?: string;
}

/**
 * 본문에 쓰면 안 되는 구조 용어.
 *
 * 독자가 알 필요가 없고 전부 쉬운 말이 있는 것들이다. 프롬프트에 변환표를 줬지만,
 * 지시만으로는 지켜지지 않는다는 것을 해요체에서 이미 봤다(51% -> 변환표 -> 0%).
 * 여기서 세지 않으면 다시 돌아온다.
 *
 * 실측(gpt-5.6, 105문장): 용어 61회 중 이 목록이 33회를 차지했다.
 */
const STRUCTURE_TERMS = [
  "일간", "일주", "일지", "월지", "연지", "시지", "월간", "연간",
  "대운", "세운", "월운", "신강", "신약",
  "비견", "겁재", "관성", "재성", "인성", "식상", "비겁",
];

/**
 * 남겨도 되는 고유명 — 그 사람 명식에만 있는 이름.
 * 지우면 일반 연애 조언과 구별되지 않는다. 다만 절당 1개까지, 첫 등장에 괄호 설명이
 * 붙어야 한다.
 */
const NAMED_TERMS = [
  "정관", "편관", "정재", "편재", "식신", "상관", "정인", "편인",
  "도화", "홍염", "역마", "화개", "양인", "원진",
  "삼합", "육합", "천간합", "지지충",
  "갑기합", "을경합", "병신합", "정임합", "무계합",
  "자오충", "축미충", "인신충", "묘유충", "진술충", "사해충",
  "목국", "화국", "금국", "수국",
  // 형(刑) — 다른 고유명과 같은 취급이다. 괄호 설명 없이 쓰면 위반.
  "인사신 삼형", "축술미 삼형", "자묘 상형",
  "진진 자형", "오오 자형", "유유 자형", "해해 자형",
];

/** 절당 허용하는 고유명 개수 */
const NAMED_BUDGET = 1;

/**
 * 절당 강조 개수.
 *
 * 아래로도 위로도 재는 이유가 다르다. 하나도 없으면 색 체계를 만든 값을 못 하고,
 * 너무 많으면 강조가 배경이 된다 — 열 군데가 칠해진 문단에서 독자는 아무것도
 * 고르지 못한다. 둘 다 문장이 나가는 걸 막지는 않고 기록만 남긴다.
 */
const MARK_MIN = 2;
const MARK_MAX = 7;

/**
 * 그 용어가 처음 나올 때 괄호 설명이 붙었는가 — "정임합(서로 끌어당기는 짝)"
 *
 * 창이 3자였을 때 "인사신 삼형 부분(...)" 처럼 부속어가 끼면 설명을 달았는데도
 * 위반으로 잡혔다. 조사 하나·부속어 하나는 넘어가되, 문장이 다음 절로 넘어갈
 * 만큼 멀어지면 그건 그 용어의 설명이 아니다.
 */
const GLOSS_WINDOW = 8;

function isGlossed(text: string, term: string): boolean {
  const at = text.indexOf(term);
  if (at < 0) return false;
  const after = text.slice(at + term.length, at + term.length + GLOSS_WINDOW);
  // 창 안에 문장이 끝나거나 다른 강조가 시작되면 그 괄호는 남의 것이다.
  const stop = after.search(/[.!?\n]|\[\[/);
  const window = stop >= 0 ? after.slice(0, stop) : after;
  const opens = window.indexOf("(");
  if (opens < 0 || /[^\s가-힣,·]/.test(window.slice(0, opens))) return false;

  // 괄호가 붙었다고 다 설명은 아니다. "소한(小寒)" 은 한자 병기이지 풀이가 아니다 —
  // 그 괄호를 읽고 나서도 독자가 아는 것이 하나도 늘지 않는다. 한자만 든 괄호는
  // 설명으로 세지 않는다. (Gemini 로 한 번 돌렸더니 이 꼴로 검사를 통과했다.)
  const rest = text.slice(at + term.length + opens + 1);
  const close = rest.indexOf(")");
  const gloss = close >= 0 ? rest.slice(0, close) : rest.slice(0, 24);
  return /[가-힣]/.test(gloss);
}

// ── 명식을 받아야만 할 수 있는 검사 ──────────────────────────
//
// 여기 아래가 이번에 새로 생긴 부분이다. 위쪽 검사는 리포트만 보고 판정하므로
// "명식에 없는 글자를 이름으로 부르는" 문제를 원리적으로 못 잡는다. 사·신 두 글자를
// "인사신 삼형" 이라 부른 문장은 문법도 어법도 멀쩡했고, 그래서 그대로 나갔다.

/** "경로=값" 을 가른다. 값 안에 = 이 또 있을 수 있으므로 첫 = 에서만 자른다. */
function splitFactEntry(entry: string): { path: string; value: string } | null {
  const at = entry.indexOf("=");
  if (at <= 0) return null;
  return { path: entry.slice(0, at).trim(), value: entry.slice(at + 1).trim() };
}

function resolvePath(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  // "luckContext.upcoming[0]" 처럼 첨자를 쓰는 것도 받는다. 모델이 자연스럽게 쓰는
  // 표기이고, 못 읽으면 맞는 근거가 "그런 경로가 없다" 로 잡힌다.
  for (const segment of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (!segment) continue;
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** 대괄호·따옴표·사이 공백을 걷어내고 목록끼리 견준다 */
function sameList(actual: string[], written: string): boolean {
  const parts = written
    .trim()
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((piece) => piece.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  return parts.length === actual.length && parts.every((piece, i) => piece === actual[i]);
}

function valueMatches(resolved: unknown, expected: string): boolean {
  if (resolved === undefined) return false;
  if (resolved === null) return expected === "null" || expected === "없음";
  if (Array.isArray(resolved)) {
    if (resolved.length === 0) return expected === "없음" || expected === "";
    // 모델이 배열을 적는 방식은 한 가지가 아니다. 실제로 본 것만 네 꼴이다 —
    //   편인,정인      ["편인","정인"]      [편인, 정인]      편인, 정인
    // 다 같은 값을 가리킨다. 적는 방식이 다른 것을 값이 다른 것으로 세면,
    // 맞는 근거가 위반으로 잡히고 그 리포트는 고칠 것이 없는데도 다시 만들어진다.
    // 원소 안에 쉼표가 들어 있는 배열(예: "사신형=일지,연지,월운")은 조각으로 갈라
    // 견줄 수 없다. 통째로 이어 붙인 꼴을 먼저 본다.
    const bare = expected.trim().replace(/^\[|\]$/g, "");
    if (resolved.map(String).join(",") === bare) return true;
    if (resolved.map(String).join(", ") === bare) return true;
    if (sameList(resolved.map(String), expected)) return true;
    return resolved.some((item) => String(item) === expected || String(item).includes(expected));
  }
  // 경로가 값이 아니라 묶음을 가리키면 그것은 근거가 아니다 —
  // "luckContext=..." 로는 무엇을 짚었는지 알 수 없다.
  if (typeof resolved === "object") return false;
  return String(resolved) === expected;
}

/**
 * 낱말이 그 뜻으로 쓰였는가.
 *
 * "상관" 은 십성 이름이면서 흔한 한국어다. "상관없어요" 를 십성으로 세면
 * 멀쩡한 문장이 매번 위반으로 잡힌다.
 */
const AMBIGUOUS_TERM: Record<string, RegExp> = {
  상관: /상관\s*(없|있|하)/,
};

function mentions(text: string, term: string): boolean {
  if (!text.includes(term)) return false;
  const ambiguous = AMBIGUOUS_TERM[term];
  if (!ambiguous) return true;
  // 애매한 쓰임을 다 지우고도 남아 있으면 그 뜻으로 쓴 것이다.
  return text.replace(new RegExp(ambiguous.source, "g"), "").includes(term);
}

/** 이 명식이 실제로 가진 이름들. 여기 없는 고유명은 그 사람 것이 아니다. */
function allowedNamedTerms(facts: SajuFacts): string[] {
  const out: string[] = [];
  for (const fact of facts.tenGods) out.push(fact.tenGod);
  out.push(...facts.dominantTenGods);

  const luck = facts.luckContext;
  if (luck.majorLuck) out.push(luck.majorLuck.currentTenGod);
  out.push(luck.yearly.tenGod, luck.monthly.tenGod);
  for (const month of luck.upcoming.months) out.push(month.tenGod);
  if (luck.upcoming.nextYear) out.push(luck.upcoming.nextYear.tenGod);

  for (const shinsal of facts.shinsal) out.push(shinsal.name);
  for (const relation of facts.notableRelations) out.push(relation.label, relation.kind);
  for (const x of [...facts.xing, ...facts.xingLuck]) out.push(xingLabel(x));
  return out;
}

/**
 * 본문에 나타나야만 근거로 인정하는 경로.
 *
 * strength.label=신약 같은 것은 본문에 그 낱말이 나올 수 없다 — 구조 용어라 쉬운 말로
 * 풀어 쓰게 돼 있다. 반면 관계와 신살은 이름 그대로 쓰라고 한 것들이라, 본문에
 * 흔적이 없으면 그 절은 그 근거를 쓰지 않은 것이다.
 */
const CHIP_MUST_APPEAR = /^(relationBundles|shinsal|stemCombos|xingLuck)/;

/**
 * 이 근거가 절의 판단에 닿아 있는가.
 *
 * 두 가지 길 중 하나면 된다.
 *   1) 본문이 그 이름을 쓴다
 *   2) 그 관계를 조건으로 쓰는 검수 규칙을 그 절이 인용한다 (rule trace)
 *
 * 2번이 없으면 안 된다. 고유명은 절당 하나까지라, 이름을 안 쓰고 결만 풀어 쓴 절이
 * 정상인데도 전부 위반이 된다 — "가까운 사이에서만 드러나는 걸림이 있어요" 는
 * 사신형을 쓴 문장이지 안 쓴 문장이 아니다.
 */
const RELATION_CONDITION_KEYS = [
  "xingPair",
  "xingKind",
  "xingCompleteness",
  "xingAtDayBranch",
  "xingLuckScope",
  "relationKind",
  "dayBranchClashed",
  "shinsal",
  "partnerShinsal",
  "partnerRelationBundle",
  "pairRelation",
  "pairMonthBranchRelation",
] as const;

function chipUsed(body: string, value: string, citedRules: ReadingRule[]): boolean {
  // 모델이 배열을 JSON 꼴로 적으면 대괄호와 따옴표가 이름에 붙어 온다. 걷어내지 않으면
  // `["화개=월지"]` 의 이름이 `["화개` 가 되어 본문과 영영 안 맞는다.
  // "(부분)" 같은 꼬리표도 이름의 일부가 아니다 — 본문은 그 꼬리표를 안 쓴다.
  const names = value
    .replace(/["'[\]]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/[+,@=]/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  if (names.some((name) => name.length >= 2 && body.includes(name))) return true;

  // 이름을 안 썼어도, 그 관계를 조건으로 쓰는 규칙을 인용했다면 근거는 이어져 있다.
  return citedRules.some((rule) =>
    RELATION_CONDITION_KEYS.some((key) => (rule.when as Record<string, unknown>)[key] !== undefined)
  );
}

function chartsOf(options: GuardOptions): SajuFacts[] {
  return [options.facts, options.partnerFacts].filter(Boolean) as SajuFacts[];
}

// ── 상대를 두고 성향을 단정한 문장 ──
//
// 문장 안에 "상대"와 성향 낱말이 함께 있다는 것만으로는 부족하다.
//   "당신은 분위기를 읽고, 상대가 편할 말을 골라 건네는 편이에요"
// 이 문장의 주어는 당신이다. 상대는 목적어 자리에 있을 뿐인데 낱말만 세면 걸린다.
// 그래서 **화제(topic)가 상대인 경우**만 본다 — 상대는/상대은, 또는 다른 화제가
// 앞서지 않은 채로 나온 상대가/상대이.
const PARTNER_TOPIC = /(상대방|상대|그\s?사람|그분)\s*(는|은)/;
const PARTNER_SUBJECT = /(상대방|상대|그\s?사람|그분)\s*(가|이)/;
const OTHER_TOPIC = /(당신|너|그대|두 사람|둘)\s*(는|은|이)/;
const DISPOSITION =
  /(성향|기질|성격|편이에요|편이야|편입니다|편이라|사람이에요|사람이라|스타일|타입|경향이|버릇)/;

/** 이 문장이 상대를 두고 내린 판단인가 */
function isPartnerClaim(sentence: string): boolean {
  if (!DISPOSITION.test(sentence)) return false;
  if (PARTNER_TOPIC.test(sentence)) return true;
  return PARTNER_SUBJECT.test(sentence) && !OTHER_TOPIC.test(sentence);
}

/** 상대에 대한 판단을 떠받칠 수 있는 규칙인가 */
function supportsPartnerClaim(rule: ReadingRule): boolean {
  const w = rule.when;
  return Boolean(
    w.pairRelation ||
      w.needsPartner ||
      w.partnerStrength ||
      w.partnerMissingElement ||
      w.partnerLuckTenGodAny ||
      w.partnerDominantTenGod ||
      w.partnerHiddenStem ||
      w.partnerRelationBundle ||
      w.pairElementComplement ||
      w.pairMonthBranchRelation
  );
}

/** 목차가 앞으로를 약속한 절인가 */
const TIMING_PROMISE =
  /(앞으로|향후)\s*\d+\s*(개월|달)|다음 기회|또 오는지|마지막 기회|남은 해|내년/;

function myeongriChecks(report: StructuredReport, options: GuardOptions): GuardViolation[] {
  const out: GuardViolation[] = [];
  const add = (v: GuardViolation) => out.push(v);
  const facts = options.facts;
  if (!facts) return out;

  const charts = chartsOf(options);
  const slim = slimFacts(facts);
  const partnerSlim = options.partnerFacts ? slimFacts(options.partnerFacts) : null;
  const allowed = charts.flatMap(allowedNamedTerms);
  const matchedIds = new Set((options.matchedRules ?? []).map((rule) => rule.id));
  const dynamicNames = charts.flatMap((c) => [...c.xing, ...c.xingLuck].map((x) => xingLabel(x)));

  report.sections.forEach((section, index) => {
    const where = `sections[${index}]`;
    const body = [
      section.verdict ?? "",
      section.summary,
      ...section.paragraphs,
      section.watchOut ?? "",
    ].join(" ");

    // ── 형을 넓혀 부르지 않았는가 ──
    for (const [kind, label] of Object.entries(XING_GROUP_LABEL)) {
      if (!THREE_XING_GROUP_LABELS.includes(label)) continue;
      if (!body.includes(label)) continue;
      const relevant = charts
        .flatMap((c) => [...c.xing, ...c.xingLuck])
        .filter((x) => x.kind === kind);
      if (relevant.some((x) => x.completeness === "complete")) continue;
      const partial = relevant.find((x) => x.completeness === "partial");
      add({
        kind: "명리",
        code: "GUARD-XING-OVERNAME",
        where,
        blocking: true,
        detail: partial
          ? `"${label}" 이라고 썼는데 실제로 선 것은 ${xingLabel(partial)}(${partial.branches.join("·")}) 두 글자다 — 이름에 명식에 없는 글자가 들어갔다`
          : `"${label}" 이라고 썼는데 이 명식에 그런 형이 없다`,
      });
    }

    // ── 고유명이 이 명식에 실재하는가 ──
    for (const term of [...NAMED_TERMS, ...dynamicNames]) {
      if (!mentions(body, term)) continue;
      if (THREE_XING_GROUP_LABELS.includes(term)) continue; // 위에서 이미 봤다
      if (allowed.some((name) => name === term || name.includes(term))) continue;
      add({
        kind: "명리",
        code: "GUARD-NAMED-TERM-ABSENT",
        where,
        blocking: true,
        detail: `"${term}" 은 이 명식에 없다 — 계산값에 없는 이름을 본문이 쓰고 있다`,
      });
    }

    // ── 같은 자리를 두 구조로 세지 않았는가 ──
    //
    // 한 문장 안에서 함께 부른 것은 묶어 읽은 것이다 —
    //   "사신합과 사신형이 함께 걸린 자리라 놓지도 편하지도 못해요"
    // 이건 시키는 대로 한 것이지 이중 계상이 아니다. 문장이 갈라졌을 때만 잡는다.
    const sentences = body.split(/[.!?\n]+/);
    for (const chart of charts) {
      for (const bundle of chart.relationBundles) {
        if (bundle.combinedInterpretationPolicy !== "single_bundle") continue;
        const labels = [...new Set(bundle.relations.map((r) => r.label))];
        if (labels.filter((l) => body.includes(l)).length < 2) continue;
        // 두 이름이 한 문장에 함께 든 적이 한 번이라도 있으면 묶어 읽은 것으로 본다.
        const merged = sentences.some((line) => labels.every((l) => line.includes(l)));
        if (merged) continue;
        add({
          kind: "명리",
          code: "GUARD-UNBUNDLED-RELATION-COUNT",
          where,
          blocking: true,
          detail: `${bundle.id} 한 자리를 ${labels.join(", ")} 두 구조로 나눠 세고 있다 — 같은 ${bundle.branches.join("·")} 두 글자다`,
        });
      }
    }

    // ── 근거가 실제 계산값과 같은가 ──
    for (const entry of section.factsUsed) {
      const parsed = splitFactEntry(entry);
      if (!parsed) {
        add({
          kind: "근거",
          code: "GUARD-FACT-PATH-MISMATCH",
          where: `${where}.facts_used`,
          blocking: true,
          detail: `"${entry}" — "경로=값" 꼴이 아니다`,
        });
        continue;
      }
      // 모델은 입력 JSON 의 키를 그대로 적기도 한다 — "saju_facts.strength.label".
      // 프롬프트는 접두어 없이 적으라고 하지만, 그건 표기 규약이지 값의 문제가 아니다.
      // 여기서 막으면 맞는 근거가 "그런 경로가 없다"로 잡힌다. Gemini 로 한 번 돌렸더니
      // 위반 78건 중 스물몇 건이 이것이었다.
      const raw = parsed.path;
      const partner =
        raw.startsWith("상대.") || raw.startsWith("partner_saju_facts.");
      const root = partner ? partnerSlim : slim;
      const path = raw
        .replace(/^상대\./, "")
        .replace(/^partner_saju_facts\./, "")
        .replace(/^saju_facts\./, "");
      if (!root) {
        add({
          kind: "근거",
          code: "GUARD-FACT-PATH-MISMATCH",
          where: `${where}.facts_used`,
          blocking: true,
          detail: `"${entry}" — 상대 명식이 없는 리딩이다`,
        });
        continue;
      }
      const resolved = resolvePath(root, path);
      if (valueMatches(resolved, parsed.value)) {
        // 값은 맞는데 본문이 그것을 한 번도 쓰지 않았다면, 그 칩은 판단을 떠받치는
        // 근거가 아니라 칸을 채운 것이다. 실제로 "notableRelations=축미충,사신합" 이
        // 결정적 근거 세 개 중 하나로 올라갔는데 두 절 다 축미충을 한 줄도 쓰지 않았다.
        // 근거를 셋으로 못 박은 계약이 있는 한 이 자리는 비면 채워진다.
        const citedRules = (options.matchedRules ?? []).filter((rule) =>
          section.ruleIds.includes(rule.id)
        );
        if (CHIP_MUST_APPEAR.test(path) && !chipUsed(body, parsed.value, citedRules)) {
          add({
            kind: "근거",
            code: "GUARD-FACT-CHIP-UNUSED",
            where: `${where}.facts_used`,
            blocking: true,
            detail: `"${entry}" — 값은 맞지만 본문이 이 관계를 한 번도 쓰지 않았다`,
          });
        }
        continue;
      }
      add({
        kind: "근거",
        code: "GUARD-FACT-PATH-MISMATCH",
        where: `${where}.facts_used`,
        blocking: true,
        detail:
          resolved === undefined
            ? `"${entry}" — 그런 경로가 계산값에 없다`
            : `"${entry}" — 계산값은 ${JSON.stringify(resolved)} 이다`,
      });
    }

    // ── 인용한 규칙이 실제로 켜진 규칙인가 ──
    if (options.matchedRules) {
      for (const id of section.ruleIds) {
        if (matchedIds.has(id)) continue;
        add({
          kind: "근거",
          code: "GUARD-RULE-NOT-MATCHED",
          where: `${where}.rule_ids`,
          blocking: true,
          detail: `"${id}" 는 이 명식에서 켜진 규칙이 아니다`,
        });
      }
    }

    // ── 상대를 두고 내린 판단에 근거가 있는가 ──
    if (!(options.matchedRules ?? []).some(supportsPartnerClaim)) {
      for (const sentence of body.split(/[.!?\n]+/)) {
        if (!isPartnerClaim(sentence)) continue;
        add({
          kind: "명리",
          code: "GUARD-UNSUPPORTED-PARTNER-CLAIM",
          where,
          blocking: true,
          detail: `상대의 성향을 단정했는데 그것을 떠받치는 규칙이 없다 — "${sentence.trim().slice(0, 40)}"`,
        });
        break; // 한 절에 한 번만 알린다
      }
    }

    // ── 앞으로를 약속한 절에 앞으로의 데이터가 있는가 ──
    if (TIMING_PROMISE.test(section.title) || TIMING_PROMISE.test(section.navLabel)) {
      const upcoming = facts.luckContext.upcoming;
      if (upcoming.months.length < 6 || !upcoming.nextYear) {
        add({
          kind: "범위",
          code: "GUARD-TIMING-WINDOW-MISSING",
          where,
          blocking: true,
          detail: `"${section.title}" 은 앞으로를 약속하는데 계산된 앞날은 ${upcoming.months.length}개월뿐이다`,
        });
      } else if (!upcoming.months.some((m) => body.includes(`${m.month}월`))) {
        add({
          kind: "범위",
          code: "GUARD-TIMING-WINDOW-UNUSED",
          where,
          blocking: false,
          detail: `"${section.title}" 이 앞으로의 달을 하나도 짚지 않았다 — 계산은 ${upcoming.months.length}개월이 나와 있다`,
        });
      }
    }
  });

  // ── 이 상품이 몇 개의 판단 위에 서 있는가 ──
  if (options.matchedRules && options.productDomain) {
    const coverage = productCoverage({
      product: options.productDomain,
      matchedRules: options.matchedRules,
      sections: report.sections.map((section, index) => ({
        id: section.id || `sections[${index}]`,
        ruleIds: section.ruleIds,
        factsUsed: section.factsUsed,
      })),
    });
    for (const finding of coverageFindings(coverage)) {
      add({
        kind: "범위",
        code: finding.code,
        where: finding.where,
        // 규칙이 모자란 것은 모델이 다시 쓴다고 해결되지 않는다.
        // 기록은 남기되 재생성으로 몰지 않는다 — 사람이 상품을 손봐야 하는 일이다.
        blocking: false,
        detail: finding.detail,
      });
    }
  }

  return out;
}

export function checkReport(report: StructuredReport, options: GuardOptions): GuardResult {
  const violations: GuardViolation[] = [];
  const add = (v: GuardViolation) => violations.push(v);

  // ── 표현 ──
  for (const { where, text } of scannableText(report)) {
    for (const [pattern, label] of ABSOLUTE_PATTERNS) {
      if (pattern.test(text)) {
        add({ kind: "단정", where, detail: `단정 표현 "${label}"`, blocking: true });
      }
    }
    for (const [pattern, label] of OUT_OF_SCOPE) {
      if (pattern.test(text)) {
        add({ kind: "선넘음", where, detail: label, blocking: true });
      }
    }
    for (const claim of options.forbiddenClaims ?? []) {
      if (claim && text.includes(claim)) {
        add({ kind: "단정", where, detail: `규칙이 금지한 주장 "${claim}"`, blocking: true });
      }
    }
    // 구조 용어는 본문에 있으면 안 된다 — 쉬운 말로 쓸 수 있는 것들이다.
    for (const term of STRUCTURE_TERMS) {
      if (text.includes(term)) {
        add({ kind: "용어", where, detail: `구조 용어 "${term}" — 쉬운 말로 바꿔야 한다`, blocking: false });
      }
    }
  }

  // ── 용어: 고유명은 절당 예산 안에서, 반드시 괄호 설명과 함께 ──
  //
  // 정명 뒤로 형의 이름은 명식마다 달라진다 — "사신형", "술미형" 같은 것은 미리
  // 적어 둘 수 없다. 붙박이 목록만 보면 이 이름들이 설명 없이 새 나간다.
  const namedTerms = [
    ...NAMED_TERMS,
    ...new Set(
      chartsOf(options).flatMap((chart) =>
        [...chart.xing, ...chart.xingLuck].map((x) => xingLabel(x))
      )
    ),
  ];
  report.sections.forEach((section, index) => {
    const body = [section.summary, ...section.paragraphs, section.watchOut ?? ""].join(" ");
    const used = namedTerms.filter((t) => mentions(body, t));
    for (const term of used) {
      if (!isGlossed(body, term)) {
        add({
          kind: "용어",
          where: `sections[${index}]`,
          detail: `"${term}" 에 괄호 설명이 없다`,
          blocking: false,
        });
      }
    }
    if (used.length > NAMED_BUDGET) {
      add({
        kind: "용어",
        where: `sections[${index}]`,
        detail: `고유명 ${used.length}개 (${used.join(", ")}) — 절당 ${NAMED_BUDGET}개까지`,
        blocking: false,
      });
    }
  });

  // ── 강조: 색이 뜻을 갖는지는 못 재도, 몇 개인지는 잴 수 있다 ──
  report.sections.forEach((section, index) => {
    const marked = [section.summary, ...section.paragraphs].join(" ");
    const counts = countMarks(marked);
    const total = totalMarks(marked);
    const where = `sections[${index}]`;

    if (total < MARK_MIN) {
      add({
        kind: "강조",
        where,
        detail: `강조 ${total}개 — 절당 ${MARK_MIN}개 이상`,
        blocking: false,
      });
    }
    if (total > MARK_MAX) {
      add({
        kind: "강조",
        where,
        detail: `강조 ${total}개 — ${MARK_MAX}개를 넘으면 강조가 아니라 배경이 된다`,
        blocking: false,
      });
    }
    // 한 종류로만 도배하면 색을 나눈 뜻이 없다
    for (const [kind, count] of Object.entries(counts)) {
      if (count > 4) {
        add({
          kind: "강조",
          where,
          detail: `"${kind}" 강조가 ${count}개 — 한 종류가 절을 덮고 있다`,
          blocking: false,
        });
      }
    }
    // 화면에 대괄호가 그대로 뜨는 것만은 막아야 한다
    if (stripMarks(marked) !== marked && /\[\[|\]\]/.test(stripMarks(marked))) {
      add({
        kind: "강조",
        where,
        detail: "강조 표기가 깨져 대괄호가 본문에 남았다",
        blocking: true,
      });
    }
  });

  // ── 구조 ──
  if (options.expectedSections > 0 && report.sections.length !== options.expectedSections) {
    add({
      kind: "구조",
      where: "sections",
      detail: `섹션 ${report.sections.length}개 — 목차는 ${options.expectedSections}개`,
      blocking: true,
    });
  }
  // 파서가 3개로 잘라내므로 여기서 걸리면 항상 모자란 쪽이다.
  // 마지막 장이 통째로 이 세 문항이라 비면 장 하나가 빈다.
  if (report.actionQuestions.length < 3) {
    add({
      kind: "구조",
      where: "action_questions",
      detail: `${report.actionQuestions.length}개 — 3개여야 한다`,
      blocking: true,
    });
  }

  const headline = report.meta.headline.length;
  if (headline < 20 || headline > 80) {
    add({ kind: "구조", where: "meta.headline", detail: `${headline}자 (20~80 권장)`, blocking: false });
  }
  // 분량은 summary 하나가 아니라 절 전체로 잰다.
  // 실제 출력을 보면 모델은 요약을 100자쯤으로 짧게 쓰고 나머지를 문단으로 넘긴다.
  // 요약만 재면 멀쩡한 절이 전부 위반으로 잡혀 신호가 묻힌다.
  report.sections.forEach((section, index) => {
    const length = section.summary.length + section.paragraphs.join("").length;
    if (length < 220) {
      add({ kind: "구조", where: `sections[${index}]`, detail: `본문 ${length}자 — 너무 얇다`, blocking: false });
    }
    if (length > 1800) {
      add({ kind: "구조", where: `sections[${index}]`, detail: `본문 ${length}자 — 너무 길다`, blocking: false });
    }
  });

  // ── 근거 ──
  const withoutFacts = report.sections.filter((section) => section.factsUsed.length === 0);
  if (withoutFacts.length > 0) {
    // 한두 건은 기록만, 절반을 넘으면 근거 없이 쓴 리포트로 본다
    const blocking = withoutFacts.length > report.sections.length / 2;
    add({
      kind: "근거",
      where: "sections[].facts_used",
      detail: `${withoutFacts.length}/${report.sections.length}개 섹션에 근거가 없다`,
      blocking,
    });
  }

  violations.push(...myeongriChecks(report, options));
  // 조후·격국·용신은 승인 상태를 함께 봐야 판정할 수 있어 따로 둔다.
  // facts 가 없으면 이 검사도 돌지 않는다 — 예전 호출부는 그대로 지나간다.
  violations.push(...checkAdvanced(report, options.facts?.advanced));

  return {
    ok: violations.length === 0,
    mustRetry: violations.some((v) => v.blocking),
    needsReview: violations.some((v) => v.code !== undefined && DEPLOY_BLOCKING_CODES.has(v.code)),
    violations,
  };
}

/** 재요청에 붙일 지적 사항 */
export function guardRetryPrompt(violations: GuardViolation[]): string {
  const blocking = violations.filter((v) => v.blocking);
  const lines = blocking.map((v) => `- ${v.where}: ${v.detail}`);
  return `방금 출력이 아래 규칙을 어겼어. 같은 JSON 스키마로 다시 쓰되 이 부분만 고쳐.

${lines.join("\n")}

고칠 때 지킬 것:
- 단정 표현은 가능성의 언어로 바꾼다. ("반드시 연락이 온다" -> "먼저 연락이 닿기 쉬운 구간이에요")
- 의료·법률·금융 판정은 문장째로 뺀다.
- 섹션 수와 action_questions 개수는 지시한 그대로 맞춘다.
- 각 섹션의 facts_used에 근거를 남긴다.
설명 없이 JSON 객체 하나만 출력해.`;
}

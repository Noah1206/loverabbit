// 리포트 출고 검사.
//
// 프롬프트로 "단정 표현을 쓰지 마라"라고 적어두는 것과, 실제로 안 쓰였는지 확인하는 것은
// 다른 일이다. 여기서는 모델이 돌려준 리포트를 내보내기 전에 한 번 훑는다.
//
// 검사 결과는 두 갈래다.
//   blocking — 다시 시켜야 하는 것 (단정 예언, 의료·법률·금융 판정, 섹션 수 어긋남)
//   advisory — 기록만 남기는 것 (길이, 근거 누락 한두 건)
// 8000 토큰짜리 생성을 headline이 세 글자 길다고 다시 돌릴 이유는 없다.

import type { StructuredReport } from "@/lib/reading-prompt";

export interface GuardViolation {
  kind: "단정" | "선넘음" | "구조" | "근거" | "용어";
  /** 어디서 걸렸는지 — "sections[3].summary" */
  where: string;
  detail: string;
  blocking: boolean;
}

export interface GuardResult {
  ok: boolean;
  /** 다시 시켜야 하는 위반이 있는가 */
  mustRetry: boolean;
  violations: GuardViolation[];
}

// 단정 예언 — 명리는 확정을 말하지 않는다.
// '운명'과 '재회'는 낱말 자체가 아니라 단정으로 쓰인 꼴만 잡는다.
const ABSOLUTE_PATTERNS: [RegExp, string][] = [
  [/반드시/, "반드시"],
  [/무조건/, "무조건"],
  [/틀림없이/, "틀림없이"],
  [/100\s*%/, "100%"],
  [/확정(적|이다|입니다|이에요|돼요|됩니다)/, "확정"],
  [/운명(이다|입니다|이에요|이야)/, "운명이다"],
  [/(재회|이별|결혼|헤어)(한다|합니다|해요|하게 된다|하게 됩니다)/, "결과 단정"],
  [/(반드시|꼭)\s*(올|옵니다|와요)/, "연락 단정"],
];

// 선을 넘는 판정 — 의료·법률·금융
const OUT_OF_SCOPE: [RegExp, string][] = [
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

/** 그 용어가 처음 나올 때 괄호 설명이 붙었는가 — "정임합(서로 끌어당기는 짝)" */
function isGlossed(text: string, term: string): boolean {
  const at = text.indexOf(term);
  if (at < 0) return false;
  const after = text.slice(at + term.length, at + term.length + 3);
  return /^\s*\(/.test(after);
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
  report.sections.forEach((section, index) => {
    const body = [section.summary, ...section.paragraphs, section.watchOut ?? ""].join(" ");
    const used = NAMED_TERMS.filter((t) => body.includes(t));
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

  return {
    ok: violations.length === 0,
    mustRetry: violations.some((v) => v.blocking),
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

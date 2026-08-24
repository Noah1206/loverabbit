// Threads 초안 출고 검사.
//
// reading-guard.ts 와 같은 자리에 있지만 재는 것이 다르다. 리포트는 절이 몇 개인지,
// 근거가 붙었는지를 봤다. Threads는 글자 수와 "입력에 없는 것이 들어왔는가"를 본다.
// 자동화가 무너지는 방식이 다르기 때문이다 — 리포트는 근거 없이 길어지고,
// Threads는 모양을 맞추려고 없는 순위를 만든다.
//
// 단정 표현 표는 reading-guard 에서 그대로 가져온다. 하면 안 되는 말은 같다.

import { ABSOLUTE_PATTERNS, OUT_OF_SCOPE } from "@/lib/reading-guard";
import type { CorpusRow, SajushibaPattern } from "@/lib/threads-corpus";
import { unknownSourceIds } from "@/lib/threads-corpus";
import type {
  AuthorizedReuseMode,
  LoveRabbitContentInput,
  ThreadPostBody,
} from "@/lib/threads-content";
import { MAX_POST_CHARS, countChars } from "@/lib/threads-content";
import {
  isVerbatim,
  reuseDecision,
} from "@/content/reference/sajushiba/permission-registry";
import type { ThreadDraftOut } from "@/lib/threads-prompt";

export interface ThreadViolation {
  kind: "길이" | "사실" | "단정" | "선넘음" | "출처" | "CTA" | "브랜드" | "말투" | "개인정보" | "재사용" | "중복";
  where: string;
  detail: string;
  blocking: boolean;
}

export interface ThreadGuardResult {
  ok: boolean;
  /** blocking 이 하나라도 있으면 guard_failed. 없고 advisory 만 있으면 needs_review */
  mustRetry: boolean;
  needsReview: boolean;
  violations: ThreadViolation[];
}

/**
 * 순위·점수를 가리키는 말.
 *
 * 입력에 ranking 이 없는데 이 말들이 나오면, 모델이 패턴의 모양을 맞추려고
 * 순위를 만들어낸 것이다. SS-P01·SS-P02가 순위 패턴이라 이 실패가 실제로 잦다.
 */
const RANK_WORDS = [/\d+\s*위/, /TOP\s*\d/i, /상위권/, /하위권/, /딱\s*셋/, /순위/, /\d+\s*점/];

/** 행운색·방향 — 승인 테이블이 없는 축 */
const COLOR_WORDS = [/행운\s*색/, /피할\s*색/, /좋은\s*색/, /행운의?\s*방향/];

/** 다른 계정·브랜드의 고유명. 본문에 남으면 러브레빗 글이 아니게 된다. */
const FOREIGN_BRANDS = [/사주시바/, /도사\s*시바/, /시바(야|가|는|의)/];

/**
 * 브랜드 이름 오기.
 *
 * 실측에서 나왔다 — 첫 스무 개 중 하나가 "러브래빗이야"로 나갔다.
 * 계정 이름을 틀리는 것은 문장이 좀 어색한 것과 다른 종류의 사고라 blocking 이다.
 */
const BRAND_TYPO = /러브(?!레빗)[가-힣]{0,2}빗|럽레빗|러브\s+레빗/;

/**
 * 문장 끝맺음으로 재는 말투.
 *
 * 패턴이 반말이면 반말로, 존댓말이면 존댓말로 끝까지 간다. 섞이면 한 사람이
 * 쓴 글로 읽히지 않는다. 완벽하게 가르는 규칙은 없어서 끝 글자만 본다 —
 * 그것만으로도 실제로 섞인 글은 걸린다.
 */
const POLITE_END = /(요|니다|죠|습니까)[.!?…]?$/;
const CASUAL_END = /(어|아|야|지|해|봐|께|게|거든|잖아)[.!?…]?$/;

/** 문장으로 갈라 끝 글자만 센다. 패턴 공식과 초안 본문에 같은 자를 댄다. */
function countTone(text: string): { polite: number; casual: number } {
  const sentences = text
    .split(/[\n.!?…]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  return {
    polite: sentences.filter((s) => POLITE_END.test(s)).length,
    casual: sentences.filter((s) => CASUAL_END.test(s)).length,
  };
}

export type PatternTone = "polite" | "casual";

/**
 * 이 패턴이 요구하는 말투.
 *
 * 지금까지 가드는 "한 초안 안에서 섞이지 마라"만 봤고 **어느 쪽인지는 안 봤다.**
 * 그래서 SS-P03(반말이 규격인 패턴)으로 쓴 존댓말 초안이 그대로 통과해 큐에
 * 앉았고, 다음 주 리뷰가 그 이탈본을 기준 삼아 정상본을 고치라고 지목했다 —
 * 규격에 맞게 나온 글을 두 번 다시 쓰게 만들었다.
 *
 * 두 군데서 읽는다. 순서가 있다.
 *   1. style_markers 에 "반말"/"존댓말"이 적혀 있으면 그것이 선언이다.
 *   2. 없으면 패턴 자신의 공식 문장(hook/body/conversion)에서 잰다.
 *      허가받은 원문에서 뽑은 문장이라 그 말투가 곧 그 패턴의 말투다.
 *
 * 2번은 여유를 두고 판정한다 — 한쪽이 두 문장 이상이면서 반대쪽의 두 배는 되어야
 * 한다. 공식에는 자리표시자가 섞여 있어 한두 문장은 반대로 끝나기 때문이다
 * (실제로 SS-P03 은 반말 4 / 존댓말 1 이다). 판정이 안 서면 null 을 주고, 이
 * 검사는 그 패턴에 대해 아무 말도 하지 않는다. 애매한 것을 우겨서 잡으면
 * 멀쩡한 초안이 매번 사람 손으로 넘어간다.
 */
export function patternTone(pattern: SajushibaPattern | undefined): PatternTone | null {
  if (!pattern) return null;

  const declared = pattern.style_markers.join(" ");
  if (/반말/.test(declared) && !/존댓말/.test(declared)) return "casual";
  if (/존댓말/.test(declared) && !/반말/.test(declared)) return "polite";

  // 자리표시자는 세지 않는다. {trait} 같은 것이 문장 끝에 오면 말투가 아니라
  // 중괄호를 재게 된다.
  const formulas = [pattern.hook_formula, ...pattern.body_formula, pattern.conversion_bridge]
    .filter(Boolean)
    .join("\n")
    .replace(/\{[^}]*\}/g, "X");
  const { polite, casual } = countTone(formulas);
  if (casual >= 2 && casual >= polite * 2) return "casual";
  if (polite >= 2 && polite >= casual * 2) return "polite";
  return null;
}

/** 생년월일시로 읽히는 꼴 — 로그·fixture·본문 어디에도 남으면 안 된다 */
const BIRTH_PATTERNS = [
  /\b(19|20)\d{2}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?\s*(생|출생|태어)/,
  /\b(19|20)\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}\s*\d{1,2}\s*시/,
];

/**
 * 간지로 읽히는 두 글자 — "병오년", "을미월", "갑자일", 또는 홀로 선 "경오".
 *
 * 천간·지지 표를 그냥 이어 붙이면 흔한 낱말이 줄줄이 걸린다. 실제로 "갑자기"가
 * 갑+자로 잡혀 멀쩡한 초안 하나가 막혔다. 같은 꼴이 한둘이 아니다 —
 * 무술·임신·경신·신축·기미·병신·정사가 전부 간지 조합이면서 흔한 낱말이다.
 *
 * 그래서 두 가지만 간지로 본다.
 *   1. 뒤에 년·월·일·시가 붙은 것       — "병오일"
 *   2. 앞뒤가 한글이 아닌 채로 홀로 선 것 — "오늘의 일진: 경오"
 * 조사가 붙은 "경오는" 은 놓친다. 대신 "무술을 배웠어"를 잡지 않는다.
 * 입력이 간지를 준 레인에서는 어차피 지정된 간지가 본문에 있는지를 따로 보므로,
 * 이쪽을 좁게 잡는 편이 손해가 적다.
 */
const GANJI_MENTION =
  /[갑을병정무기경신임계][자축인묘진사오미신유술해](?:[년월일시]|(?![가-힣]))/;

export interface ThreadGuardOptions {
  input: LoveRabbitContentInput;
  corpus: CorpusRow[];
  /** 원문 문장을 그대로 옮기는 것이 허용됐는가 (환경변수 스위치) */
  allowDirectCopy: boolean;
  /** 이 초안이 원문을 어디까지 쓰기로 한 모드인가 */
  reuseMode?: AuthorizedReuseMode;
  /** 이 초안이 따르기로 한 패턴. 말투 규격이 여기서 온다 (patternTone 참조) */
  pattern?: SajushibaPattern;
}

/**
 * 이 겹침이 허가된 것인가.
 *
 * 네 가지가 전부 맞아야 통과한다. 하나라도 어긋나면 예전처럼 막는다.
 *   1. 초안이 그 게시물을 직접 재사용 출처로 신고했는가
 *   2. 레지스트리가 그 게시물에 verbatim_* 를 허용하는가
 *   3. 그 겹침이 directCopySpans 에 정확히 기록됐는가
 *   4. 허가 증빙 세 줄이 채워졌는가
 *
 * 셋째 조건이 핵심이다. 신고 없이 옮기는 것을 허용하면 추적이 거짓말이 되고,
 * 그러면 "허가 범위 안에서만 썼다"를 나중에 증명할 수 없다.
 */
export function isAuthorizedVerbatimOverlap(
  overlap: string,
  sourcePostId: string,
  draft: Pick<ThreadDraftOut, "directCopySourcePostIds" | "directCopySpans">,
  reuseMode: AuthorizedReuseMode,
  extractionStatus?: CorpusRow["extraction_status"]
): boolean {
  if (!isVerbatim(reuseMode)) return false;
  if (!draft.directCopySourcePostIds.includes(sourcePostId)) return false;

  const decision = reuseDecision(sourcePostId, reuseMode, { extractionStatus });
  if (!decision.ok) return false;

  const flat = (s: string) => s.replace(/\s+/g, "");
  const target = flat(overlap);
  return (draft.directCopySpans ?? []).some(
    (span) => span.sourcePostId === sourcePostId && flat(span.text).includes(target)
  );
}

/**
 * 원문과 겹치는 긴 마디를 찾는다.
 *
 * 모델이 신고하지 않고 옮기는 경우가 있어, 신고(directCopyExcerpts)를 믿지 않고
 * 직접 잰다. 12자를 창으로 잡은 이유는 그 아래에서는 흔한 관용구가 걸리기 때문이다
 * ("먼저 연락해 보세요" 는 아홉 자다).
 */
const SHINGLE = 12;

export function verbatimOverlap(
  text: string,
  corpus: CorpusRow[]
): Array<{ postId: string; text: string }> {
  const clean = (s: string) => s.replace(/\s+/g, "");
  const flat = clean(text);
  const hits: Array<{ postId: string; text: string }> = [];
  if (flat.length < SHINGLE) return hits;

  for (const row of corpus) {
    const source = clean(row.body);
    let longest = "";
    for (let i = 0; i + SHINGLE <= flat.length; i += 1) {
      const window = flat.slice(i, i + SHINGLE);
      if (!source.includes(window)) continue;
      // 걸렸으면 뒤로 늘려 실제로 몇 자가 겹치는지 잰다
      let end = i + SHINGLE;
      while (end < flat.length && source.includes(flat.slice(i, end + 1))) end += 1;
      const matched = flat.slice(i, end);
      if (matched.length > longest.length) longest = matched;
      i = end - 1;
    }
    if (longest) hits.push({ postId: row.post_id, text: longest });
  }
  return hits;
}

export function checkThreadDraft(
  draft: ThreadDraftOut,
  posts: ThreadPostBody[],
  options: ThreadGuardOptions
): ThreadGuardResult {
  const violations: ThreadViolation[] = [];
  const add = (v: ThreadViolation) => violations.push(v);
  const { input, corpus, allowDirectCopy } = options;
  const whole = posts.map((p) => p.body).join("\n");

  // ── 길이 ──
  posts.forEach((post) => {
    if (post.charCount > MAX_POST_CHARS) {
      add({
        kind: "길이",
        where: `posts[${post.sequence}]`,
        detail: `${post.charCount}자 — ${MAX_POST_CHARS}자를 넘는다`,
        blocking: true,
      });
    }
    // 모바일에서 스크롤이 길어지는 지점. 막지는 않는다.
    if (post.charCount > 420) {
      add({
        kind: "길이",
        where: `posts[${post.sequence}]`,
        detail: `${post.charCount}자 — 모바일에서 접힌다. 체인 분할을 검토`,
        blocking: false,
      });
    }
  });
  if (posts.length === 0) {
    add({ kind: "길이", where: "posts", detail: "본문이 비었다", blocking: true });
  }
  if (posts.length > 5) {
    add({ kind: "길이", where: "posts", detail: `${posts.length}개 — 체인은 5개까지`, blocking: true });
  }

  // ── 사실: 승인 목록 밖의 rule / claim ──
  const okRules = new Set(input.approvedFacts.map((f) => f.ruleId));
  const okClaims = new Set(input.approvedFacts.map((f) => f.claimId));
  for (const id of draft.ruleIdsUsed) {
    if (!okRules.has(id)) {
      add({ kind: "사실", where: "ruleIdsUsed", detail: `승인 목록 밖의 rule_id — ${id}`, blocking: true });
    }
  }
  for (const id of draft.claimIdsUsed) {
    if (!okClaims.has(id)) {
      add({ kind: "사실", where: "claimIdsUsed", detail: `승인 목록 밖의 claim_id — ${id}`, blocking: true });
    }
  }
  if (draft.ruleIdsUsed.length === 0 && input.approvedFacts.length > 0) {
    add({ kind: "사실", where: "ruleIdsUsed", detail: "승인 사실을 실었는데 쓴 규칙이 하나도 기록되지 않았다", blocking: true });
  }

  // ── 사실: 입력에 없는 축이 본문에 나타났는가 ──
  if (!input.variables.ranking) {
    for (const pattern of RANK_WORDS) {
      const hit = pattern.exec(whole);
      if (hit) {
        add({
          kind: "사실",
          where: "posts",
          detail: `입력에 ranking 이 없는데 순위 표현이 있다 — "${hit[0]}"`,
          blocking: true,
        });
        break;
      }
    }
  }
  if (!input.variables.colors) {
    for (const pattern of COLOR_WORDS) {
      const hit = pattern.exec(whole);
      if (hit) {
        add({
          kind: "사실",
          where: "posts",
          detail: `입력에 colors 가 없는데 색 이야기가 있다 — "${hit[0]}"`,
          blocking: true,
        });
        break;
      }
    }
  }
  if (!input.variables.ganji) {
    const hit = GANJI_MENTION.exec(whole);
    if (hit) {
      add({
        kind: "사실",
        where: "posts",
        detail: `입력에 ganji 가 없는데 간지가 있다 — "${hit[0]}"`,
        blocking: true,
      });
    }
  } else if (!whole.includes(input.variables.ganji)) {
    // 입력이 준 간지와 다른 간지를 쓰지는 않았는지
    const hit = GANJI_MENTION.exec(whole);
    if (hit && !hit[0].startsWith(input.variables.ganji)) {
      add({
        kind: "사실",
        where: "posts",
        detail: `입력의 간지는 "${input.variables.ganji}" 인데 본문은 "${hit[0]}"`,
        blocking: true,
      });
    }
  }
  // 순위를 실었으면 그 순위 그대로여야 한다
  for (const entry of input.variables.ranking ?? []) {
    if (!whole.includes(entry.label)) {
      add({
        kind: "사실",
        where: "posts",
        detail: `입력 순위 ${entry.rank}위 "${entry.label}" 가 본문에 없다`,
        blocking: true,
      });
    }
  }
  if (input.variables.date && !input.variables.ganji) {
    // 날짜를 안 준 글에 날짜가 나오면 그것도 지어낸 것이다
  }

  // ── 단정·선넘음 ──
  for (const [pattern, label] of ABSOLUTE_PATTERNS) {
    if (pattern.test(whole)) {
      add({ kind: "단정", where: "posts", detail: `단정 표현 "${label}"`, blocking: true });
    }
  }
  for (const [pattern, label] of OUT_OF_SCOPE) {
    if (pattern.test(whole)) {
      add({ kind: "선넘음", where: "posts", detail: label, blocking: true });
    }
  }

  // ── 출처 ──
  const unknown = unknownSourceIds(
    [...draft.benchmarkSourcePostIds, ...draft.directCopySourcePostIds],
    corpus
  );
  for (const id of unknown) {
    add({
      kind: "출처",
      where: "sourcePostIds",
      detail: `코퍼스 밖의 source post — ${id}. 허가는 corpus.v1.jsonl 안에만 걸려 있다`,
      blocking: true,
    });
  }

  // ── CTA ──
  const ctaHits = [
    /저장/, /댓글/, /공유/, /팔로우/, /링크/, /https?:\/\//,
  ].filter((p) => p.test(whole)).length;
  if (ctaHits > 2) {
    add({
      kind: "CTA",
      where: "posts",
      detail: `CTA 로 읽히는 표현이 ${ctaHits}종 — 하나만 남긴다`,
      blocking: true,
    });
  }
  if (draft.cta.type && input.variables.cta.type && draft.cta.type !== input.variables.cta.type) {
    add({
      kind: "CTA",
      where: "cta.type",
      detail: `입력은 ${input.variables.cta.type} 인데 초안은 ${draft.cta.type}`,
      blocking: true,
    });
  }

  // ── 브랜드 ──
  for (const pattern of FOREIGN_BRANDS) {
    const hit = pattern.exec(whole);
    if (hit) {
      add({
        kind: "브랜드",
        where: "posts",
        detail: `다른 계정의 고유명이 본문에 남았다 — "${hit[0]}"`,
        blocking: true,
      });
    }
  }
  const typo = BRAND_TYPO.exec(whole);
  if (typo) {
    add({
      kind: "브랜드",
      where: "posts",
      detail: `브랜드 이름 오기 — "${typo[0]}" (러브레빗)`,
      blocking: true,
    });
  }

  // ── 말투 ──
  // CTA 줄은 입력이 정해 준 문장이라 뺀다. 그 줄까지 세면 CTA가 존댓말인 반말 글이
  // 매번 혼용으로 걸려, 정작 본문이 섞인 글과 구별되지 않는다.
  const ctaText = input.variables.cta.text.trim();
  const sentences = whole
    .split(/[\n.!?…]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && (!ctaText || !ctaText.includes(s)));
  const polite = sentences.filter((s) => POLITE_END.test(s)).length;
  const casual = sentences.filter((s) => CASUAL_END.test(s)).length;
  if (polite >= 2 && casual >= 2) {
    add({
      kind: "말투",
      where: "posts",
      detail: `존댓말 ${polite}문장 / 반말 ${casual}문장 — 한 초안 안에서 섞였다`,
      blocking: false,
    });
  }

  // 섞였는지만이 아니라 **어느 쪽인지**를 본다. 패턴이 말투를 정해 두었는데
  // 초안이 반대로 갔으면, 그건 글이 예쁘냐 마냐가 아니라 규격 이탈이다.
  //
  // 막지는 않는다(needs_review 로 간다). 끝 글자만 보는 성긴 자라서, 틀린
  // 지적으로 멀쩡한 초안을 다시 쓰게 만드는 값이 사람이 한 번 보는 값보다 비싸다.
  const required = patternTone(options.pattern);
  if (required) {
    const wrong = required === "casual" ? polite : casual;
    const right = required === "casual" ? casual : polite;
    const label = required === "casual" ? "반말" : "존댓말";
    const other = required === "casual" ? "존댓말" : "반말";
    if (wrong >= 2 && wrong > right) {
      add({
        kind: "말투",
        where: "posts",
        detail:
          `이 패턴(${options.pattern!.id})은 ${label}이 규격인데 초안이 ${other}로 갔다 ` +
          `— ${other} ${wrong}문장 / ${label} ${right}문장`,
        blocking: false,
      });
    }
  }

  // ── 개인정보 ──
  for (const pattern of BIRTH_PATTERNS) {
    const hit = pattern.exec(whole);
    if (hit) {
      add({
        kind: "개인정보",
        where: "posts",
        detail: `생년월일시로 읽히는 값이 본문에 있다 — "${hit[0]}"`,
        blocking: true,
      });
    }
  }

  // ── 원문 재사용 ──
  //
  // 모드가 무엇이든 겹침은 직접 잰다. 신고를 믿고 세지 않으면, 신고하지 않고
  // 옮기는 경로가 그대로 열린다.
  const mode: AuthorizedReuseMode = options.reuseMode ?? "pattern_only";
  const spans = draft.directCopySpans ?? [];
  const declared = draft.directCopyExcerpts ?? [];
  const measured = verbatimOverlap(whole, corpus);
  const statusOf = (postId: string) =>
    corpus.find((r) => r.post_id === postId)?.extraction_status;

  if (isVerbatim(mode)) {
    // verbatim 모드인데 옮긴 구간이 하나도 없으면 모드를 잘못 고른 것이다.
    // 그대로 두면 "원문을 썼다"는 기록만 남고 실제로는 안 쓴 초안이 생긴다.
    if (spans.length === 0) {
      add({
        kind: "재사용",
        where: "directCopySpans",
        detail: `${mode} 인데 directCopySpans 가 비었다 — 옮긴 구간을 기록해야 한다`,
        blocking: true,
      });
    }
    // 신고한 구간이 정말 그 원문에 있는지 대조한다. 오프셋까지 받아 둔 이유다.
    for (const span of spans) {
      const row = corpus.find((r) => r.post_id === span.sourcePostId);
      if (!row) {
        add({
          kind: "재사용",
          where: "directCopySpans",
          detail: `코퍼스 밖 원문을 재사용으로 신고했다 — ${span.sourcePostId}`,
          blocking: true,
        });
        continue;
      }
      // 두 검사는 서로 독립이다. 허가가 아직 안 열렸더라도, 원문에 없는 구간을
      // "원문에서 가져왔다"고 신고한 것은 그 자체로 잡아야 하는 오류다.
      // 허가 쪽에서 먼저 멈추면 이 오류가 증빙을 채우는 날까지 숨는다.
      if (!row.body.replace(/\s+/g, "").includes(span.text.replace(/\s+/g, ""))) {
        add({
          kind: "재사용",
          where: "directCopySpans",
          detail: `신고한 구간이 ${span.sourcePostId} 원문에 없다 — "${span.text.slice(0, 20)}…"`,
          blocking: true,
        });
      }
      const decision = reuseDecision(span.sourcePostId, mode, {
        extractionStatus: row.extraction_status,
      });
      if (!decision.ok) {
        add({
          kind: "재사용",
          where: "directCopySpans",
          detail: `[${decision.status}] ${decision.reason}`,
          // 증빙 미입력은 사람이 채우면 풀리는 자리다. 그래도 나가지는 못한다.
          blocking: true,
        });
      }
    }
  } else if (spans.length > 0 || declared.length > 0 || draft.directCopySourcePostIds.length > 0) {
    add({
      kind: "재사용",
      where: "directCopySpans",
      detail: `${mode} 모드인데 원문 직접 재사용이 신고됐다 — 모드를 올리거나 문장을 새로 써야 한다`,
      blocking: true,
    });
  }

  // 실제로 겹치는 구간을 하나씩 판정한다.
  for (const hit of measured) {
    const authorized = isAuthorizedVerbatimOverlap(
      hit.text,
      hit.postId,
      { directCopySourcePostIds: draft.directCopySourcePostIds, directCopySpans: spans },
      mode,
      statusOf(hit.postId)
    );
    if (authorized) {
      // 허가된 겹침도 그냥 내보내지 않는다. 어느 문장을 어디서 가져왔는지
      // 사람이 승인 화면에서 보고 넘기게 한다.
      add({
        kind: "재사용",
        where: "posts",
        detail: `authorized_verbatim_overlap — ${hit.postId} 에서 ${countChars(hit.text)}자 ("${hit.text.slice(0, 20)}…")`,
        blocking: false,
      });
      continue;
    }
    // 환경변수가 꺼져 있으면 모드와 무관하게 막는다. 스위치가 마지막 잠금이다.
    const reason = !allowDirectCopy
      ? "THREADS_ALLOW_DIRECT_COPY 가 꺼져 있다"
      : `${mode} 모드에서 허가되지 않은 겹침이다`;
    add({
      kind: "재사용",
      where: "posts",
      detail: `${hit.postId} 원문과 ${countChars(hit.text)}자가 겹친다 (${reason}) — "${hit.text.slice(0, 24)}…"`,
      blocking: true,
    });
  }

  // ── 원문에 딸려 온 것들 ──
  // close_adaptation 은 문장을 새로 쓰지만, 원문의 브랜드·링크·모집 조건을
  // 그대로 옮겨 오는 실패가 잦다. 브랜드는 위에서 이미 blocking 으로 잡히고,
  // 여기서는 사주시바 쪽 외부 링크가 남았는지를 본다.
  for (const link of whole.match(/https?:\/\/[^\s)]+/g) ?? []) {
    if (!link.includes("loverebbit")) {
      add({
        kind: "브랜드",
        where: "posts",
        detail: `러브레빗 것이 아닌 링크가 남았다 — ${link}`,
        blocking: true,
      });
    }
  }
  if (/테스터|선착순|마감\s*임박|추첨/.test(whole)) {
    add({
      kind: "브랜드",
      where: "posts",
      detail: "원문의 모집·희소성 조건이 남았다 — 실제 이벤트가 없으면 쓸 수 없다",
      blocking: true,
    });
  }

  // ── 변형 기록 ──
  if (mode === "close_adaptation" && (draft.sourceTransformLog ?? []).length === 0) {
    add({
      kind: "재사용",
      where: "sourceTransformLog",
      detail: "close_adaptation 인데 무엇을 바꿨는지 기록이 없다",
      blocking: false,
    });
  }

  // ── 중복 ──
  const bodies = posts.map((p) => p.body.replace(/\s+/g, ""));
  if (new Set(bodies).size !== bodies.length) {
    add({ kind: "중복", where: "posts", detail: "체인 안에 같은 본문이 두 번 있다", blocking: true });
  }

  const mustRetry = violations.some((v) => v.blocking);
  return {
    ok: violations.length === 0,
    mustRetry,
    needsReview: !mustRetry && violations.length > 0,
    violations,
  };
}

/** 지난 초안들과 본문이 겹치는지 — 같은 글을 두 번 올리지 않기 위해 */
export function duplicateOfPrevious(
  posts: ThreadPostBody[],
  previous: string[]
): string | null {
  const flat = posts.map((p) => p.body.replace(/\s+/g, "")).join("");
  for (const old of previous) {
    const cleaned = old.replace(/\s+/g, "");
    if (!cleaned) continue;
    if (cleaned === flat) return "지난 초안과 본문이 같다";
    // 앞머리가 그대로면 같은 글의 변주다
    if (cleaned.length > 40 && flat.startsWith(cleaned.slice(0, 40))) {
      return "지난 초안과 첫 40자가 같다";
    }
  }
  return null;
}

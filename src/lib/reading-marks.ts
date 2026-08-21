// 본문 강조 — 굵게 하나, 색 셋.
//
// 색을 쓰기로 한 이상 색마다 뜻이 있어야 한다. 예쁘라고 칠한 색은 두 번째 문단부터
// 그냥 배경이 되고, 독자는 무엇이 중요한지 여전히 모른다. 그래서 AI가 강조할 때
// **왜** 강조하는지까지 함께 적게 하고, 화면은 그 뜻을 색으로 옮기기만 한다.
//
//   **텍스트**        핵심   — 이 절에서 하나만 가져간다면 이 문장
//   [[주의|텍스트]]   주의   — 걸리는 자리, 되풀이되는 지점
//   [[시기|텍스트]]   시기   — 언제인지 (2026년 8월, 올해 후반 …)
//   [[행동|텍스트]]   행동   — 지금 할 수 있는 것
//
// 넷을 넘기지 않는다. 다섯 번째 색이 생기는 순간 독자는 범례를 외워야 하고,
// 외워야 하는 순간 아무도 안 본다.
//
// 이 표기는 **본문 안에서만** 산다. 저장되는 원문(reportToText)과 추가 상담에
// 넘어가는 맥락에서는 stripMarks 로 걷어낸다 — 대괄호가 프롬프트에 섞이면
// 모델이 그걸 흉내 내기 시작한다.

export type MarkKind = "핵심" | "주의" | "시기" | "행동";

/** 색이 있는 것들. 핵심은 굵기로만 표시하므로 여기 없다. */
export const COLOR_MARKS: MarkKind[] = ["주의", "시기", "행동"];

export const MARK_MEANING: Record<MarkKind, string> = {
  핵심: "이 절의 결론",
  주의: "걸리는 자리",
  시기: "언제인지",
  행동: "지금 할 것",
};

export interface MarkToken {
  kind: MarkKind | "plain";
  text: string;
}

// [[주의|텍스트]] 또는 **텍스트**
const MARK_RE = /\[\[(주의|시기|행동)\|([^\]|]+)\]\]|\*\*([^*\n]+)\*\*/g;

/** 굵게 안쪽에 색 표기가 통째로 들어앉은 경우를 알아보기 위한 것 */
const MARK_RE_INNER = /\[\[(주의|시기|행동)\|([^\]|]+)\]\]/g;

/** 짝이 안 맞아 남은 표기 부스러기 — 화면에 대괄호가 그대로 뜨는 것만은 막는다 */
const LEFTOVER_RE = /\[\[[^\]]*\]\]|\[\[|\]\]|\*\*/g;

function cleanPlain(text: string): string {
  return text.replace(LEFTOVER_RE, (m) => {
    // [[무엇|텍스트]] 꼴이면 안쪽 텍스트는 살린다. 표기가 틀렸다고 문장을 잃을 수는 없다.
    const inner = m.match(/^\[\[(?:[^|\]]*\|)?([^\]]*)\]\]$/);
    return inner ? inner[1] : "";
  });
}

/**
 * 본문 한 덩어리를 조각으로 나눈다. 화면은 이 조각을 그대로 그린다.
 * 알 수 없는 표기는 껍데기만 벗기고 글자는 남긴다.
 */
export function parseMarks(text: string): MarkToken[] {
  const out: MarkToken[] = [];
  let last = 0;
  const push = (kind: MarkToken["kind"], value: string) => {
    if (value) out.push({ kind, text: value });
  };

  MARK_RE.lastIndex = 0;
  let matched: RegExpExecArray | null;
  while ((matched = MARK_RE.exec(text)) !== null) {
    push("plain", cleanPlain(text.slice(last, matched.index)));
    if (matched[1]) {
      push(matched[1] as MarkKind, matched[2].trim());
    } else {
      // **[[주의|텍스트]]** 처럼 겹쳐 쓰는 경우가 있다. 안쪽이 색 표기 하나뿐이면
      // 그 색을 살린다 — 굵기보다 뜻이 있는 쪽이 독자에게 더 쓸모 있다.
      const inner = matched[3].trim();
      MARK_RE_INNER.lastIndex = 0;
      const nested = MARK_RE_INNER.exec(inner);
      if (nested && nested[0] === inner) push(nested[1] as MarkKind, nested[2].trim());
      else push("핵심", cleanPlain(inner));
    }
    last = matched.index + matched[0].length;
  }
  push("plain", cleanPlain(text.slice(last)));
  return out;
}

/** 표기를 걷어낸 순수 텍스트 — 저장·검색·추가 상담 맥락에 쓴다 */
export function stripMarks(text: string): string {
  return parseMarks(text)
    .map((t) => t.text)
    .join("");
}

/**
 * 표기를 틀리게 쓴 것들.
 *
 * cleanPlain 이 깨진 표기를 조용히 고쳐서 그린다. 화면이 안 깨지는 것은 좋은데,
 * 그 덕에 **가드가 영영 못 본다.** 실제로 Gemini 가 열일곱 개를 틀리게 썼는데
 * 검사에 한 건도 안 잡혔다. 두 가지가 조용히 일어난다.
 *
 *   [[초반의 끌림|관계를 붙드는 힘]]   -> 색이 사라지고 글자만 남는다.
 *                                         모델이 강조하려던 자리가 없어진다.
 *   [[상대.luckContext.yearly.tenGod]] -> 구분자가 없으면 안쪽을 통째로 살린다.
 *                                         내부 경로가 화면에 그대로 뜬다.
 *
 * 렌더링을 고칠 일이 아니다 — 문장을 잃는 것보다는 낫다. 대신 여기서 센다.
 */
export function brokenMarks(text: string): string[] {
  const out: string[] = [];
  const all = text.match(/\[\[[^\]]*\]\]/g) ?? [];
  for (const mark of all) {
    if (/^\[\[(주의|시기|행동)\|[^\]|]+\]\]$/.test(mark)) continue;
    out.push(mark);
  }
  return out;
}

/** 한 덩어리에 강조가 몇 개 붙었는지 — 가드가 이 숫자를 본다 */
export function countMarks(text: string): Record<MarkKind, number> {
  const counts: Record<MarkKind, number> = { 핵심: 0, 주의: 0, 시기: 0, 행동: 0 };
  for (const token of parseMarks(text)) {
    if (token.kind !== "plain") counts[token.kind] += 1;
  }
  return counts;
}

export function totalMarks(text: string): number {
  return Object.values(countMarks(text)).reduce((a, b) => a + b, 0);
}

// 웹툰 문장 초안의 순수 부분 — 파싱·가드·덮어쓰기.
//
// webtoon-generate.ts 에서 갈라 나왔다. 그쪽은 server-only 라 AI 와 DB 를 부르고,
// 이쪽은 아무것도 부르지 않아서 테스트가 그대로 읽는다. 가드는 문장이 나가는
// 마지막 문이라 반드시 테스트가 붙어 있어야 한다.

import { ABSOLUTE_PATTERNS, OUT_OF_SCOPE } from "@/lib/reading-guard";
import type { WebtoonContent } from "@/lib/webtoon-saju";

export interface WebtoonDraft {
  previewText: string;
  previewPoints: string[];
  panelLines: Array<{ rabbit?: string; subject?: string }>;
  captions: string[];
  fullParagraphs: string[];
  factsUsed?: string[];
}

/**
 * 말풍선·캡션 한 줄의 길이 한계.
 *
 * 오버레이는 타원 안에 앉는다 — 길면 밖으로 흐른다. 고정 카피가 25자 안쪽이라
 * 그 두 배를 한계로 둔다. 줄바꿈은 사람이 정한 자리라 길이에서 뺀다.
 */
const OVERLAY_MAX_CHARS = 50;

function overlayTooLong(text: string): boolean {
  return text.replace(/\n/g, "").trim().length > OVERLAY_MAX_CHARS;
}

export function parseDraft(text: string): WebtoonDraft | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const d = parsed as Partial<WebtoonDraft>;
  const strings = (v: unknown, n: number) =>
    Array.isArray(v) && v.length >= n && v.every((s) => typeof s === "string" && s.trim().length > 0);

  if (typeof d.previewText !== "string" || d.previewText.trim().length < 10) return null;
  if (!strings(d.previewPoints, 3)) return null;
  if (!strings(d.fullParagraphs, 4)) return null;
  // 8컷 = 말하는 컷 5 + 배경·소품 컷 3. 모자라면 화면에 빈 말풍선이 선다.
  if (!strings(d.captions, 3)) return null;
  if ((d.captions as string[]).some(overlayTooLong)) return null;
  if (!Array.isArray(d.panelLines) || d.panelLines.length < 5) return null;
  for (const line of d.panelLines.slice(0, 5)) {
    const text = line?.rabbit ?? line?.subject;
    if (typeof text !== "string" || text.trim().length === 0) return null;
    // 너무 길면 말풍선 밖으로 흐른다. 고정 카피가 25자 안쪽이라 그 두 배를
    // 한계로 둔다 — 넘으면 이 초안을 버리고 고정 카피로 간다.
    if (overlayTooLong(text)) return null;
  }
  return d as WebtoonDraft;
}

/**
 * 표현 가드. 리딩 본문과 같은 금지 표현 표를 쓴다 — 두 벌로 두면 한쪽만 늘어난다.
 * 구조 용어는 여기서 따로 본다: 리딩 가드의 것은 StructuredReport 모양에 묶여 있다.
 */
const STRUCTURE_TERMS =
  /(십성|비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|신강|신약|중화|용신|격국|지장간|대운|세운|일간|월지|천간|지지)/;

export function guardDraft(draft: WebtoonDraft): boolean {
  const texts = [
    draft.previewText,
    ...draft.previewPoints,
    ...draft.captions,
    ...draft.fullParagraphs,
    ...draft.panelLines.map((l) => l.rabbit ?? l.subject ?? ""),
  ];
  for (const text of texts) {
    for (const [pattern] of ABSOLUTE_PATTERNS) if (pattern.test(text)) return false;
    for (const [pattern] of OUT_OF_SCOPE) if (pattern.test(text)) return false;
    if (STRUCTURE_TERMS.test(text)) return false;
  }
  return true;
}

/**
 * 초안을 고정 카피 위에 덮는다. 그림·패널 배치·좌표는 그대로 두고 문장만 갈아낀다 —
 * 오버레이가 별도 층이라 이게 가능하다.
 */
export function applyDraft(base: WebtoonContent, draft: WebtoonDraft): WebtoonContent {
  // 패널 순번으로 매칭하면 안 된다 — 8컷 중 말하는 컷은 1·3·5·7·8 이고 나머지는
  // 배경·소품이다. 초안의 대사 5개는 "말풍선이 있는 컷"에만 순서대로 들어간다.
  let lineIndex = 0;
  let captionIndex = 0;

  const panels = base.panels.map((panel) => {
    const hasSpeech = panel.overlays.some((o) => o.type === "speech");
    const line = hasSpeech ? draft.panelLines[lineIndex++] : undefined;
    const spoken = line?.rabbit ?? line?.subject ?? null;

    // 한 컷에 말풍선이 둘이면(인사+본론) 초안 한 줄을 문장 단위로 나눠 담는다.
    const speechCount = panel.overlays.filter((o) => o.type === "speech").length;
    const parts = spoken && speechCount > 1 ? splitForBubbles(spoken, speechCount) : null;
    let seen = 0;

    const overlays = panel.overlays.map((overlay) => {
      if (overlay.type === "speech") {
        const text = parts ? parts[seen++] : spoken;
        return text ? { ...overlay, text } : overlay;
      }
      if (overlay.type === "caption") {
        const caption = draft.captions[captionIndex++];
        return caption ? { ...overlay, text: caption } : overlay;
      }
      return overlay;
    });
    return { ...panel, overlays };
  });

  return {
    ...base,
    panels,
    previewText: draft.previewText,
    previewPoints: draft.previewPoints.slice(0, 3),
    fullParagraphs: draft.fullParagraphs.slice(0, 4),
  };
}


/**
 * 한 컷에 말풍선이 여럿일 때 초안 한 줄을 나눠 담는다.
 *
 * 모델에게 "이 컷은 풍선이 둘"이라고 알려주는 대신 여기서 쪼갠다 — 출력 계약을
 * 단순하게 두는 편이 실패가 적다. 문장 부호를 우선으로 자르고, 없으면 길이로 자른다.
 */
function splitForBubbles(text: string, count: number): string[] {
  if (count <= 1) return [text];
  const marks = [...text.matchAll(/[.!?…]\s*|,\s+/g)].map((m) => (m.index ?? 0) + m[0].length);
  const target = text.length / count;
  const out: string[] = [];
  let from = 0;
  for (let i = 1; i < count; i += 1) {
    const want = target * i;
    const near = marks.filter((m) => m > from).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
    const at = near ?? Math.round(want);
    out.push(text.slice(from, at).trim());
    from = at;
  }
  out.push(text.slice(from).trim());
  return out.map((x) => x || text);
}

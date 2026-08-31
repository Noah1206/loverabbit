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
  if (!strings(d.captions, 2)) return null;
  if (!Array.isArray(d.panelLines) || d.panelLines.length < 4) return null;
  for (const line of d.panelLines.slice(0, 4)) {
    const text = line?.rabbit ?? line?.subject;
    if (typeof text !== "string" || text.trim().length === 0) return null;
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
  let captionIndex = 0;
  const panels = base.panels.map((panel, i) => {
    const line = draft.panelLines[i];
    const spoken = line?.rabbit ?? line?.subject ?? null;
    const overlays = panel.overlays.map((overlay) => {
      if (overlay.type === "speech" && spoken) return { ...overlay, text: spoken };
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


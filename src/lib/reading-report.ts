// 리딩 본문을 기사처럼 읽히도록 잘라주는 순수 함수들.
// AI 응답은 "■ 소제목" 형태로 섹션을 나눠 내려오므로 그 표식을 기준으로 분해한다.

export interface ReportSection {
  title: string;
  paragraphs: string[];
}

const SECTION_MARK = /(?:^|\n)\s*(?:■|▪|●|##+)\s*/;

function toParagraphs(body: string): string[] {
  return body
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseReportSections(text: string): ReportSection[] {
  const chunks = text
    .split(SECTION_MARK)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  // 표식이 없으면(첫 조각만 남으면) 통째로 한 덩어리 기사로 취급한다
  if (chunks.length < 2) {
    return [{ title: "", paragraphs: toParagraphs(text) }];
  }

  const sections: ReportSection[] = [];
  chunks.forEach((chunk, index) => {
    const [head, ...rest] = chunk.split("\n");
    const paragraphs = toParagraphs(rest.join("\n"));
    // 첫 조각이 표식 앞의 도입부라면 제목 없는 리드 문단으로 둔다
    if (index === 0 && paragraphs.length === 0) {
      sections.push({ title: "", paragraphs: toParagraphs(head) });
      return;
    }
    sections.push({ title: head.trim(), paragraphs });
  });

  return sections.filter((section) => section.title || section.paragraphs.length > 0);
}

export function splitSentences(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?。…]+[.!?。…]?/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 4);
}

// 릴리스형 "한눈에 보기" — 티저를 문장 단위로 끊어 핵심 불릿으로 세운다
export function summaryPoints(teaser: string, max = 4): string[] {
  const sentences = splitSentences(teaser);
  if (sentences.length <= 1) return sentences;
  return sentences.slice(0, max);
}

export function readingMinutes(...texts: (string | null | undefined)[]): number {
  const chars = texts.filter(Boolean).join("").replace(/\s+/g, "").length;
  return Math.max(1, Math.round(chars / 450));
}

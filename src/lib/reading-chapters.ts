// 리포트 본문을 "장(章)" 단위로 묶는 순수 함수들.
//
// 상품 목차(products.ts의 toc)는 "1장 01. 제목" 꼴로 되어 있고, AI는 그 목차를
// 순서·개수 그대로 따라 섹션을 써 온다(reading-prompt.ts의 출력 계약).
// 그래서 장 번호는 세 단계로 복원한다.
//   1) 제목 앞머리의 "N장"을 그대로 읽는다        — 정상 경로
//   2) 접두사가 떨어져 나왔으면 목차의 같은 순번에서 장 번호를 빌린다
//   3) 그것도 안 되면 마지막 장에 붙인다
// 어떤 경우에도 문장이 사라지지 않는 것이 이 파일의 계약이다.

export interface ChapterPiece {
  title: string;
  paragraphs: string[];
}

export interface ChapterSection {
  /** 장 안에서의 순번 — 화면의 "1)" 표기 */
  order: number;
  title: string;
  paragraphs: string[];
  /** 결제 전이라 본문이 비어 있는 절 */
  locked: boolean;
}

export interface ReadingChapter {
  /** 1부터 시작하는 장 번호. 에필로그도 마지막 번호를 받는다 */
  number: number;
  /** "1장" / "마지막 장" */
  label: string;
  title: string;
  sections: ChapterSection[];
  kind: "main" | "epilogue";
  /** 이 장의 본문이 전부 잠겨 있는지 */
  locked: boolean;
}

// reportToText()가 본문 뒤에 덧붙이는 꼬리 섹션들 — 본편이 아니라 에필로그로 뺀다.
const EPILOGUE_TITLE = /(스스로 확인할 세 가지|한마디|마지막 편지|최종 조언$)/;
const CHAPTER_MARK = /^\s*(\d+)\s*장/;
const ORDER_MARK = /^\s*(?:\d+\s*장\s*)?(\d+)\s*[.)]\s*/;

/** "1장 03. 제목" -> "제목" */
function cleanTitle(title: string): string {
  return title
    .replace(CHAPTER_MARK, "")
    .replace(/^\s*\d+\s*[.)]\s*/, "")
    .replace(/^[\s—·-]+/, "")
    .trim();
}

function orderIn(title: string, fallback: number): number {
  const matched = title.match(ORDER_MARK);
  return matched ? Number(matched[1]) : fallback;
}

/** 목차 문자열 배열에서 각 항목이 몇 장에 속하는지 뽑는다 */
export function chapterNumbersFromToc(toc: string[]): number[] {
  let last = 0;
  return toc.map((item, index) => {
    const matched = item.match(CHAPTER_MARK);
    if (matched) {
      last = Number(matched[1]);
      return last;
    }
    // "01. ..." 처럼 장 표기가 없는 목차(990원 입문 리포트)는 항목 하나가 곧 한 장이다
    last = index + 1;
    return last;
  });
}

export interface BuildChaptersOptions {
  /** 상품 목차 — 장 번호를 복원할 때 기준으로 쓴다 */
  toc: string[];
  /** 분야별 장 제목. 없으면 그 장 첫 절의 제목을 장 제목으로 쓴다 */
  chapterTitles?: string[];
  /** 에필로그 장의 제목 */
  epilogueTitle?: string;
}

export function buildChapters(
  pieces: ChapterPiece[],
  { toc, chapterTitles = [], epilogueTitle = "마지막 편지" }: BuildChaptersOptions
): ReadingChapter[] {
  if (pieces.length === 0) return [];

  const tocChapters = chapterNumbersFromToc(toc);
  const maxChapter = tocChapters.length ? Math.max(...tocChapters) : 1;

  const main = new Map<number, ChapterPiece[]>();
  const epilogue: ChapterPiece[] = [];

  // 제목 없는 리드 문단(첫 조각)은 본문 첫 장 앞에 붙는 도입부라 첫 장으로 흡수한다.
  let mainIndex = 0;
  pieces.forEach((piece) => {
    if (!piece.title.trim() && piece.paragraphs.length === 0) return;

    if (piece.title && EPILOGUE_TITLE.test(piece.title) && !CHAPTER_MARK.test(piece.title)) {
      epilogue.push(piece);
      return;
    }

    const marked = piece.title.match(CHAPTER_MARK);
    const number = marked
      ? Number(marked[1])
      : (tocChapters[mainIndex] ?? tocChapters[tocChapters.length - 1] ?? maxChapter);
    mainIndex += 1;

    const bucket = main.get(number);
    if (bucket) bucket.push(piece);
    else main.set(number, [piece]);
  });

  const chapters: ReadingChapter[] = [...main.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, items], index) => {
      const sections = items.map((piece, order) => ({
        order: orderIn(piece.title, order + 1),
        title: cleanTitle(piece.title),
        paragraphs: piece.paragraphs,
        locked: piece.paragraphs.length === 0,
      }));
      return {
        number,
        label: `${index + 1}장`,
        title:
          chapterTitles[index] ??
          sections.find((section) => section.title)?.title ??
          `${index + 1}장`,
        sections,
        kind: "main" as const,
        locked: sections.every((section) => section.locked),
      };
    })
    // 장 번호가 띄엄띄엄 와도 화면에서는 1장부터 연속으로 보이게 다시 매긴다
    .map((chapter, index) => ({ ...chapter, number: index + 1, label: `${index + 1}장` }));

  if (epilogue.length > 0) {
    chapters.push({
      number: chapters.length + 1,
      label: "마지막 장",
      title: epilogueTitle,
      sections: epilogue.map((piece, order) => ({
        order: order + 1,
        title: cleanTitle(piece.title),
        paragraphs: piece.paragraphs,
        locked: piece.paragraphs.length === 0,
      })),
      kind: "epilogue",
      locked: epilogue.every((piece) => piece.paragraphs.length === 0),
    });
  }

  return chapters;
}

/** 결제 전 화면용 — 미리보기 발췌와 제목만 남은 잠긴 절을 한 줄기로 세운다 */
export function previewPieces(
  previewSections: { title: string; excerpt: string }[],
  lockedTitles: string[]
): ChapterPiece[] {
  return [
    ...previewSections.map((section) => ({
      title: section.title,
      paragraphs: section.excerpt ? [section.excerpt] : [],
    })),
    ...lockedTitles.map((title) => ({ title, paragraphs: [] })),
  ];
}

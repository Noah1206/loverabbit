// 그림이 들어갈 자리를 고르는 규칙.
//
// 컴포넌트에서 떼어 둔다. ReadingChapters.tsx 는 "use client" 라 노드 테스트에서
// 그대로 부를 수 없는데, 이 규칙은 화면 없이도 확인할 수 있어야 한다.
//
// 장 맨 위가 아니다. 거기 두면 아직 읽기도 전에 나오고, 정작 눈이 지치는 대목은
// 그림 없이 지나간다. **읽다가 슬슬 지루해질 무렵**에 넣는다.
//
// 절 개수로 세지 않고 글자 수로 센다 — 절 하나가 900자일 때와 1,400자일 때
// 지치는 시점이 다르기 때문이다. 앞에서부터 더해 가다가 이 선을 처음 넘는 절 뒤에 넣는다.
// 선을 못 넘는 짧은 장이면 맨 뒤에 놓는다. 다음 장으로 넘어가기 전의 숨이 된다.

import type { ReadingChapter } from "@/lib/reading-chapters";

/**
 * 지금 계약에서 절 하나가 1,200~1,500자다(reading-prompt.ts). 그래서 이 선을 1,400 으로
 * 두면 절을 **둘** 읽어야 그림이 나오고, 모바일에서는 그때까지 스크롤이 너무 길다.
 * 1,000 이면 대개 첫 절을 다 읽은 직후에 걸린다 — 한 덩어리를 끝내고 쉬는 자리다.
 *
 * 본문 길이 계약을 바꾸면 이 값도 함께 봐야 한다.
 */
export const ART_AFTER_CHARS = 1000;

export function artSlotOf(chapter: ReadingChapter): number {
  let read = 0;
  for (let i = 0; i < chapter.sections.length; i += 1) {
    // 요약은 이미 paragraphs[0] 으로 접혀 들어와 있다(reading-chapters.ts)
    read += chapter.sections[i].paragraphs.join("").length;
    if (read >= ART_AFTER_CHARS) return i;
  }
  return chapter.sections.length - 1;
}

export const __test = { artSlotOf, ART_AFTER_CHARS };

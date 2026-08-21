// 그림 한 장의 모양 — 화면과 서버가 함께 쓰는 값.
//
// reading-images.ts 에 있던 것을 떼어 왔다. 그 파일은 그림을 **만드는** 곳이라
// ai.ts 를 부르고, ai.ts 는 제공사 어댑터를 부른다. 그중 하나(ai-claude-code)가
// node:child_process 와 node:fs 를 쓴다.
//
// 그런데 결과 화면(reading/[id])은 그림을 만들지 않는다. 자리 번호 하나와 타입
// 하나가 필요할 뿐이다. 그 둘을 만드는 파일에서 가져오면
//
//   reading/[id]/page.tsx -> reading-images -> ai -> ai-claude-code -> node:child_process
//
// 이 길이 통째로 클라이언트 번들에 딸려 들어가고, next build 가 멈춘다.
// 실제로 그렇게 멈췄다.
//
// 값만 있는 파일로 떼어 두면 그 길이 아예 안 생긴다. 동적 import 로도 못 막는다 —
// 웹팩은 동적 import 도 따라가 조각을 만들기 때문이다. 끊어야 안 따라온다.

/** 그림 한 장의 상태. 화면은 이 값만 보고 그린다. */
export type ReadingImageStatus = "pending" | "ready" | "failed";

/**
 * 부적이 앉는 자리. 장 번호와 겹치지 않게 0 을 쓴다 —
 * 장은 1부터 세므로 0 은 비어 있고, 배열 하나로 같이 다닐 수 있다.
 */
export const TALISMAN_SLOT = 0;

export interface ReadingImage {
  /** 몇 번째 장인가. 뷰어의 장 번호와 같다. 0 이면 부적이다. */
  chapter: number;
  status: ReadingImageStatus;
  /** 완성된 그림 주소. pending·failed 면 없다. */
  url?: string;
  /** 화면 낭독기가 읽을 설명 */
  alt?: string;
}

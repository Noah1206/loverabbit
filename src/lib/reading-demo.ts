// 데모 모드 — 모델을 부르지 않고 미리 만들어 둔 리포트를 쓴다.
//
// 왜 필요한가. 무료 티어(Gemini)는 하루 20 요청이고 리포트 한 편이 아홉 요청쯤 든다.
// 하루 두 편이면 유저 테스트가 안 된다. 그런데 테스트하려는 것 대부분은 글이 아니라
// **흐름**이다 — 입력에서 티저까지 어떻게 걸어가는가, 어디서 멈추는가, 결제 버튼이
// 눈에 들어오는가. 그건 글이 매번 새로 나오지 않아도 잴 수 있다.
//
// 그래서 생성만 미리 만들어 둔 것으로 갈음한다. 명식은 진짜로 계산한다 — 계산은
// 공짜이고, 테스터가 자기 사주 네 글자를 제대로 봐야 화면이 자기 것으로 읽힌다.
//
// **글은 남의 것이다.** 그 사실을 숨기지 않는다. 응답에 demo 표시가 실려 나가고
// 화면이 그것을 그대로 보여 준다. 숨기면 테스터가 "내 얘기가 아닌 것 같다"는
// 피드백을 주고, 우리는 그게 사주 로직 문제인지 데모라서인지 구분하지 못한다.

import type { StructuredReport } from "@/lib/reading-prompt";
import SOKGUNGHAP from "@/content/demo/sokgunghap.json";
import INSUN from "@/content/demo/insun.json";
import IBYEOL from "@/content/demo/ibyeol.json";

interface DemoSlot {
  /** 아직 안 만든 자리는 false. 그 상품은 평소대로 모델을 부른다. */
  ready: boolean;
  note?: string;
  report: unknown;
}

/**
 * 데모로 쓸 자리. 광고 오퍼가 가리키는 카테고리마다 하나씩 둔다.
 *
 * 자리를 미리 만들어 두는 이유: 파일이 없으면 import 가 깨져 빌드가 멈춘다. 그러면
 * 데모 하나 추가하는 데 코드를 고쳐야 하고, 코드를 고쳐야 하는 일은 언젠가 빠뜨린다.
 * 자리를 비워 두면 scripts/demo-fixture.mts 가 그 파일만 덮어쓰면 끝난다.
 *
 * 없는 상품은 데모가 안 된다 — 아무 상품의 글이나 돌려 쓰면 목차와 본문이 어긋나고,
 * 그건 흐름 테스트도 망친다.
 */
const DEMO_SLOT_MAP: Record<string, DemoSlot> = {
  sokgunghap: SOKGUNGHAP as DemoSlot,
  insun: INSUN as DemoSlot,
  ibyeol: IBYEOL as DemoSlot,
};

/** 데모가 필요한 상품 목록 — 스크립트가 안내에 쓴다 */
export const DEMO_SLOTS = Object.keys(DEMO_SLOT_MAP);

/** 아직 안 채운 자리 */
export function pendingDemoSlots(): string[] {
  return DEMO_SLOTS.filter((id) => !DEMO_SLOT_MAP[id].ready);
}

export type DemoMode = "off" | "on";

export const DEFAULT_DEMO_MODE: DemoMode = "off";

/**
 * READING_DEMO_MODE=on 이면 데모로 돈다.
 *
 * 기본값이 off 인 이유는 분명하다. 이 스위치가 켜진 채로 배포되면 **돈 받고 남의 글을
 * 파는 일**이 된다. 켜는 것은 언제나 명시적이어야 한다.
 */
export function demoMode(): DemoMode {
  const raw = process.env.READING_DEMO_MODE;
  if (raw === "on" || raw === "off") return raw;
  if (raw) {
    console.warn(
      `READING_DEMO_MODE="${raw}" 는 알 수 없는 값입니다. on | off 중 하나여야 합니다. ` +
        `기본값 "${DEFAULT_DEMO_MODE}" 로 진행합니다.`
    );
  }
  return DEFAULT_DEMO_MODE;
}

/** 이 상품을 데모로 낼 수 있는가 */
export function hasDemoReport(category: string): boolean {
  return demoMode() === "on" && Boolean(DEMO_SLOT_MAP[category]?.ready);
}

/**
 * 미리 만들어 둔 리포트. 원본을 그대로 넘기지 않고 복사해 준다 —
 * 호출부가 절을 잘라 내는데, 그게 원본을 깎으면 다음 요청이 짧은 리포트를 받는다.
 */
export function demoReport(category: string): StructuredReport | null {
  const slot = DEMO_SLOT_MAP[category];
  if (!slot?.ready || !slot.report) return null;
  return JSON.parse(JSON.stringify(slot.report)) as StructuredReport;
}

/** 데모 글이 어느 명식에서 나온 것인가 — 화면이 밝히는 데 쓴다 */
export const DEMO_SOURCE_NOTE =
  "이 리딩의 문장은 다른 분의 명식으로 미리 만들어 둔 샘플이에요. 사주 네 글자와 지수는 입력하신 값으로 실제 계산한 것이고요.";

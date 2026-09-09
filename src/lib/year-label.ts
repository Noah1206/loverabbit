import { currentLuckPillars, CHEONGAN_OHAENG, JIJI_ANIMAL } from "@/lib/saju";

/*
  해의 이름 — "2027 붉은 양의 해" (2026-09-09 운영자).

  신년운세·하반기 섹션이 제목에 연도를 세운다. 손으로 적으면 해가 바뀔 때마다
  홈이 거짓말을 하므로 전부 계산한다. 빛깔은 천간에서, 짐승은 지지에서 온다 —
  ProductMonthNote 와 같은 규칙이고, 그 규칙은 tests/product-month-note 가 잡는다.

  **사주해가 아니라 달력해로 센다.** 신년운세가 파는 것은 "다음 달력해" 지
  "다음 입춘 이후" 가 아니다. 12월에 보는 사람에게 내년은 그냥 내년이다.
  대신 그 해의 간지는 사주 엔진이 낸다 — 이름만 달력해로 세고 성질은 명리다.
*/

const OHAENG_COLOR: Record<string, string> = {
  목: "푸른",
  화: "붉은",
  토: "누런",
  금: "하얀",
  수: "검은",
};

export interface YearLabel {
  /** 2027 */
  year: number;
  /** "정미" */
  ganji: string;
  /** "붉은" */
  color: string;
  /** "양" */
  animal: string;
  /** "붉은 양의 해" */
  phrase: string;
}

/** 그 해 한가운데(6월 1일)의 간지를 읽는다 — 입춘 경계에 걸리지 않는 날. */
export function yearLabelOf(year: number): YearLabel {
  const { year: pillar } = currentLuckPillars(new Date(year, 5, 1));
  const color = OHAENG_COLOR[CHEONGAN_OHAENG[pillar.ganIdx]] ?? "";
  const animal = JIJI_ANIMAL[pillar.jiIdx];
  return {
    year,
    ganji: `${pillar.gan}${pillar.ji}`,
    color,
    animal,
    phrase: `${color} ${animal}의 해`,
  };
}

/** 서울 기준 올해 (달력해) */
export function seoulYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }).format(now)
  );
}

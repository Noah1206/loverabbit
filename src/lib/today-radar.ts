// 오늘의 다섯 축 — 순위를 점수로 바꾼다.
//
// 왜 새 계산을 하지 않는가.
//
// 어느 영역이 오늘 흐름에 잘 붙는지는 daily-action.ts 의 DOMAIN_PRIORITY 가
// 이미 정해 두었다. 그 순서가 곧 판단이다 — 여기서 하는 일은 순서를 길이로
// 옮겨 오각형에 그리는 것뿐이다.
//
// **점수를 지어내지 않는다.** 명리에 "재물운 87점" 같은 값은 없다. 있는 것은
// "오늘 흐름에 재물이 몇 번째로 붙는가" 이고, 그것을 눈에 보이게 바꾼 것이
// 이 파일이다. 그래서 숫자를 화면에 적지 않는다 — 모양만 보여준다.
//
// 축이 다섯인 이유: 여덟을 다 그리면 팔각형이 되어 어느 쪽이 긴지 안 보인다.
// 사람들이 가장 많이 찾는 다섯을 남기고 나머지 셋(관계·자기계발)은 뺐다.

import { DOMAIN_PRIORITY_OF, type Flow, type FortuneDomain } from "@/lib/daily-action";

/** 오각형에 세우는 다섯 축. 시계 방향으로 위부터 */
export const RADAR_AXES: { domain: FortuneDomain; label: string }[] = [
  { domain: "money", label: "재물운" },
  { domain: "love", label: "연애운" },
  { domain: "business", label: "사업운" },
  { domain: "health", label: "건강운" },
  { domain: "study", label: "학업운" },
];

export interface RadarPoint {
  domain: FortuneDomain;
  label: string;
  /** 0.3 ~ 1.0 — 오각형에서 중심으로부터의 거리 비율 */
  ratio: number;
}

/**
 * 오늘 흐름에서 다섯 축의 길이.
 *
 * 우선순위 여덟 자리 중 몇 번째인지로 길이를 정한다. 1위가 가장 길고
 * 8위가 가장 짧다. 최소를 0.34 로 둔 이유는, 0 에 가까우면 그 축이 "없다"
 * 로 읽히기 때문이다 — 순위가 낮다는 것은 오늘 덜 붙는다는 뜻이지
 * 나쁘다는 뜻이 아니다.
 */
export function radarOf(flow: Flow): RadarPoint[] {
  const order = DOMAIN_PRIORITY_OF(flow);
  return RADAR_AXES.map(({ domain, label }) => {
    const rank = order.indexOf(domain); // 0 = 1위
    const ratio = 1 - (rank < 0 ? order.length - 1 : rank) / (order.length - 1);
    return { domain, label, ratio: 0.34 + ratio * 0.62 };
  });
}

/** 오각형 꼭짓점 좌표 — 위에서 시작해 시계 방향 */
export function radarPolygon(points: RadarPoint[], size: number): string {
  const c = size / 2;
  const r = c * 0.78;
  return points
    .map((p, i) => {
      const angle = (Math.PI * 2 * i) / points.length - Math.PI / 2;
      const x = c + Math.cos(angle) * r * p.ratio;
      const y = c + Math.sin(angle) * r * p.ratio;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** 격자(바깥 테두리와 안쪽 눈금)용 — ratio 를 고정해 같은 함수로 그린다 */
export function radarRing(count: number, size: number, ratio: number): string {
  const c = size / 2;
  const r = c * 0.78;
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    return `${(c + Math.cos(angle) * r * ratio).toFixed(1)},${(c + Math.sin(angle) * r * ratio).toFixed(1)}`;
  }).join(" ");
}

/**
 * 라벨을 놓을 자리 — 꼭짓점보다 조금 바깥.
 *
 * 1.2 배로 두었더니 위쪽 라벨이 카드 밖으로 나가 고정 헤더에 가렸다.
 * 1.13 으로 당기고, 차트 위에 여백을 줘서(CSS) 두 겹으로 막는다.
 */
export function radarLabelPos(i: number, count: number, size: number) {
  const c = size / 2;
  const r = c * 0.78 * 1.13;
  const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
  return { x: c + Math.cos(angle) * r, y: c + Math.sin(angle) * r };
}

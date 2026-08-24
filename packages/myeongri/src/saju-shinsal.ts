// 신살(神殺) 계산 — 명식의 특정 글자 조합에 붙는 이름표.
//
// 상품 목차가 "도화는 몇 개이고 어디에 있는가"를 약속하고 있으므로, 이 값은
// 반드시 계산으로 나와야 한다. AI가 지어내면 EVIDENCE POLICY 위반이다.
//
// 판본에 대하여:
//   도화·역마·화개는 삼합국에서 기계적으로 떨어지므로 자료 간 이견이 없다.
//   홍염·양인은 표가 갈린다. 여기서는 아래 판본 하나를 고정해 쓰고, 바꾸고 싶으면
//   이 파일의 표만 고치면 되도록 한곳에 모아 두었다.
//     - 홍염: 갑을오 / 병인 / 정미 / 무기진 / 경술 / 신유 / 임자 / 계신
//     - 양인: 양간만 본다 (갑묘 / 병무오 / 경유 / 임자). 음간 양인은 취하지 않음.
//
// 해석 문장은 여기에 넣지 않는다. 여기는 "무엇이 있는가"까지고,
// "그래서 어떻다"는 reading-rules.ts가 맡는다.

import { JIJI, type Pillar, type SajuChart } from "./saju";

export type ShinsalName = "도화" | "홍염" | "역마" | "화개" | "양인" | "원진";

export type BranchPosition = "연지" | "월지" | "일지" | "시지";

export interface ShinsalFact {
  name: ShinsalName;
  /** 그 신살이 앉은 자리 — 개수와 위치를 함께 담는다 */
  positions: BranchPosition[];
  /** 어느 기준에서 나왔는지. 근거 추적용이며 그대로 사용자에게 보여도 말이 된다. */
  basis: string;
}

// 삼합국 — [생지, 왕지, 고지], 국 이름
const TRIPLES: { members: [number, number, number]; label: string }[] = [
  { members: [8, 0, 4], label: "신자진 수국" },
  { members: [11, 3, 7], label: "해묘미 목국" },
  { members: [2, 6, 10], label: "인오술 화국" },
  { members: [5, 9, 1], label: "사유축 금국" },
];

/** 삼합 기준으로 떨어지는 세 신살의 목표 지지 */
const TRIPLE_SHINSAL: { name: ShinsalName; pick: (t: [number, number, number]) => number; note: string }[] = [
  // 도화(년살) — 왕지의 앞 글자. 신자진->유, 해묘미->자, 인오술->묘, 사유축->오
  { name: "도화", pick: ([saeng]) => (saeng + 1) % 12, note: "삼합 생지의 다음 글자" },
  // 역마 — 생지를 충하는 글자
  { name: "역마", pick: ([saeng]) => (saeng + 6) % 12, note: "삼합 생지의 충" },
  // 화개 — 삼합의 고지
  { name: "화개", pick: ([, , go]) => go, note: "삼합의 고지" },
];

// 홍염살 — 일간 기준 (갑~계 순서)
const HONGYEOM: number[] = [6, 6, 2, 7, 4, 4, 10, 9, 0, 8];

// 양인 — 양간만. 음간 자리는 -1로 두어 건너뛴다. (갑~계 순서)
const YANGIN: number[] = [3, -1, 6, -1, 6, -1, 9, -1, 0, -1];

// 원진 쌍 — 자미, 축오, 인유, 묘신, 진해, 사술
export const WONJIN: [number, number][] = [
  [0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10],
];

const POSITIONS: BranchPosition[] = ["연지", "월지", "일지", "시지"];

interface Slot {
  position: BranchPosition;
  jiIdx: number;
}

function slotsOf(chart: SajuChart): Slot[] {
  const pillars: (Pillar | null)[] = [chart.year, chart.month, chart.day, chart.hour];
  return pillars
    .map((pillar, index) => (pillar ? { position: POSITIONS[index], jiIdx: pillar.jiIdx } : null))
    .filter((slot): slot is Slot => slot !== null);
}

function tripleOf(jiIdx: number) {
  return TRIPLES.find((triple) => triple.members.includes(jiIdx)) ?? null;
}

/**
 * 명식에서 신살을 찾는다. 같은 신살이 여러 기준(연지·일지)에서 나오면 한 항목으로 합치고,
 * 자리와 근거를 모두 남긴다.
 */
export function findShinsal(chart: SajuChart): ShinsalFact[] {
  const slots = slotsOf(chart);
  const found = new Map<ShinsalName, { positions: Set<BranchPosition>; bases: string[] }>();

  const add = (name: ShinsalName, positions: BranchPosition[], basis: string) => {
    if (positions.length === 0) return;
    const entry = found.get(name) ?? { positions: new Set<BranchPosition>(), bases: [] };
    for (const position of positions) entry.positions.add(position);
    if (!entry.bases.includes(basis)) entry.bases.push(basis);
    found.set(name, entry);
  };

  // ── 삼합 기준: 연지와 일지 둘 다에서 본다 ──
  const anchors: { label: BranchPosition; jiIdx: number }[] = [
    { label: "연지", jiIdx: chart.year.jiIdx },
    { label: "일지", jiIdx: chart.day.jiIdx },
  ];

  for (const anchor of anchors) {
    const triple = tripleOf(anchor.jiIdx);
    if (!triple) continue;
    for (const rule of TRIPLE_SHINSAL) {
      const target = rule.pick(triple.members);
      const hits = slots.filter((slot) => slot.jiIdx === target).map((slot) => slot.position);
      add(
        rule.name,
        hits,
        `${anchor.label} ${JIJI[anchor.jiIdx]} 기준 ${triple.label} → ${JIJI[target]} (${rule.note})`
      );
    }
  }

  // ── 일간 기준 ──
  const dayGan = chart.day.ganIdx;

  const hongyeom = HONGYEOM[dayGan];
  add(
    "홍염",
    slots.filter((slot) => slot.jiIdx === hongyeom).map((slot) => slot.position),
    `일간 ${chart.day.gan} 기준 → ${JIJI[hongyeom]}`
  );

  const yangin = YANGIN[dayGan];
  if (yangin >= 0) {
    add(
      "양인",
      slots.filter((slot) => slot.jiIdx === yangin).map((slot) => slot.position),
      `일간 ${chart.day.gan}(양간) 기준 → ${JIJI[yangin]}`
    );
  }

  // ── 지지끼리: 원진 ──
  for (const [a, b] of WONJIN) {
    const left = slots.filter((slot) => slot.jiIdx === a);
    const right = slots.filter((slot) => slot.jiIdx === b);
    if (left.length === 0 || right.length === 0) continue;
    add(
      "원진",
      [...left, ...right].map((slot) => slot.position),
      `${JIJI[a]}${JIJI[b]} 원진`
    );
  }

  // 표기 순서는 고정한다 — 같은 명식이면 언제나 같은 순서로 나와야 한다
  const ORDER: ShinsalName[] = ["도화", "홍염", "역마", "화개", "양인", "원진"];
  return [...found.entries()]
    .sort((x, y) => ORDER.indexOf(x[0]) - ORDER.indexOf(y[0]))
    .map(([name, entry]) => ({
      name,
      positions: POSITIONS.filter((position) => entry.positions.has(position)),
      basis: entry.bases.join(" / "),
    }));
}

/** 특정 신살이 몇 자리에 앉았는지 — 지수 계산과 규칙 매칭이 함께 쓴다 */
export function shinsalCount(facts: ShinsalFact[], name: ShinsalName): number {
  return facts.find((fact) => fact.name === name)?.positions.length ?? 0;
}

export function hasShinsal(facts: ShinsalFact[], name: ShinsalName): boolean {
  return shinsalCount(facts, name) > 0;
}

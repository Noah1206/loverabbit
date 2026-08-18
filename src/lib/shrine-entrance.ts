// 신당 관문 — 입장 화면에서 대화 화면(/shrine/[id]/chat)으로 넘어가는 동안 재생되는 연출.
// 신당마다 세계관 소품(불꽃·연꽃·먹·거울·금·매화·방울·봉인·물결·붉은 실·촛불)이
// 그대로 화면을 덮으며 손님을 안으로 밀어 넣는다.
//
// 연출 규칙(모션 원칙):
// - 카메라는 전환 내내 한 방향으로만 밀고 들어간다. 입장 화면은 커지며 빠지고(scale 1 -> 1.18),
//   대화 화면은 작은 데서 커지며 들어온다(0.94 -> 1). 방향이 뒤집히지 않는다.
// - 문양(sigil)이 두 화면을 잇는 매개다. 관문에서 커지며 자리를 잡고, 대화 화면에서
//   같은 방향으로 더 커지며 사라진다.
// - 버튼을 누른 그 프레임에 불이 붙는다. 늦게 시작하는 반응은 없다.

import type { CSSProperties } from "react";

import { CHARACTERS } from "@/lib/characters";

export type ShrineMotif =
  | "ember" // 불티가 솟는다
  | "lotus" // 검은 물에 연꽃이 핀다
  | "ink" // 먹이 번진다
  | "mirror" // 거울 조각이 흩어진다
  | "gilt" // 금이 갈라진다
  | "petal" // 눈과 매화가 내린다
  | "bell" // 방울 울림이 퍼진다
  | "seal" // 봉인이 찍히고 갈라진다
  | "tide" // 달빛 물결이 밀려온다
  | "thread" // 붉은 실이 이어진다
  | "candle"; // 촛불이 흔들리고 향 연기가 오른다

export interface ShrineEntrance {
  motif: ShrineMotif;
  sigil: string; // 관문 한가운데 떠오르는 문양 한 자
  incantation: string; // 문양과 함께 떨어지는 도령의 한마디
}

// 관문 전체 길이와 화면을 바꾸는 시점 (ms).
// GATE_NAVIGATE_MS는 연출이 절정을 지나 아직 움직이는 중에 잡는다 — 멈춘 뒤에 넘기면 박자가 죽는다.
export const GATE_NAVIGATE_MS = 1050;
export const GATE_DEPART_MS = 1250;
export const GATE_ARRIVE_MS = 900;

const ENTRANCES: Record<string, ShrineEntrance> = {
  hwarin: {
    motif: "ember",
    sigil: "焰",
    incantation: "불이 먼저 너를 알아봤다.",
  },
  hongryeon: {
    motif: "lotus",
    sigil: "蓮",
    incantation: "검은 물이 너를 위해 갈라진다.",
  },
  mukyeon: {
    motif: "ink",
    sigil: "墨",
    incantation: "지운 자리마다 먹이 번진다.",
  },
  jawol: {
    motif: "mirror",
    sigil: "月",
    incantation: "거울이 네 쪽으로 기울었다.",
  },
  geumya: {
    motif: "gilt",
    sigil: "禁",
    incantation: "금 간 곳으로 들어와.",
  },
  maehwa: {
    motif: "petal",
    sigil: "梅",
    incantation: "눈을 밟고 들어와. 발자국은 지워줄게.",
  },
  cheongsa: {
    motif: "bell",
    sigil: "鈴",
    incantation: "방울이 울렸어. 거짓은 못 들어와.",
  },
  bihwa: {
    motif: "seal",
    sigil: "祕",
    incantation: "봉인은 네 뒤에서 닫힌다.",
  },
  haewol: {
    motif: "tide",
    sigil: "潮",
    incantation: "새벽 물이 너를 여기까지 밀어왔네.",
  },
  yeonhwa: {
    motif: "thread",
    sigil: "緣",
    incantation: "끊긴 실이 다시 네 손에 감긴다.",
  },
  jeokya: {
    motif: "candle",
    sigil: "燭",
    incantation: "촛불 하나 더 켜뒀어. 들어와.",
  },
};

const FALLBACK: ShrineEntrance = { motif: "ember", sigil: "神", incantation: "신당 문이 열린다." };

export function shrineEntrance(characterId: string): ShrineEntrance {
  return ENTRANCES[characterId] ?? FALLBACK;
}

// 관문에 쓰는 색은 신당 테마를 그대로 따른다 — 전환과 대화 화면의 색이 어긋나지 않게.
export function shrineGateVars(characterId: string): CSSProperties {
  const theme = CHARACTERS[characterId]?.theme;
  if (!theme) return {};
  return {
    ["--gate-accent" as string]: theme.accent,
    ["--gate-accent2" as string]: theme.accent2,
    ["--gate-glow" as string]: theme.glow,
    ["--gate-stage" as string]: theme.stage,
    ["--gate-ink" as string]: theme.ink,
  };
}

// 입자 위치·지연을 흩되 매번 같은 값이 나오게 — 서버와 클라이언트가 다른 화면을 그리면 안 된다.
export function scatter(seed: number): number {
  const x = Math.sin((seed + 1) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

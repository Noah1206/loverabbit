// 십이지 캐릭터 — 띠 하나에 그림 한 장.
//
// 왜 따로 두는가.
//
// 토끼는 이미 있다. 다만 그 여섯 장(`rabbit-*-hanbok.webp`)은 **띠가 아니라
// 오늘의 흐름**에 붙어 있다 — 비겁이면 두 손을 펼치고 인성이면 졸린 눈이다
// (daily-action.ts 의 FLOW_RABBIT). "이 사람이 무슨 띠인가"는 그것과 다른
// 축이라, 같은 표에 섞으면 토끼가 두 가지 뜻을 동시에 지게 된다.
//
// 계산은 하나도 새로 하지 않는다. computeSaju 가 이미 `animal` 을 내주고
// (saju.ts:96), 만세력과 사주지도가 그것을 "○○띠" 로 쓰고 있다. 여기가 하는
// 일은 그 **이름 하나로 그림을 찾는 것**뿐이다.
//
// 왜 인덱스가 아니라 이름으로 찾는가. 화면까지 내려오는 값이 지지 인덱스가
// 아니라 문자열("토끼")이기 때문이다. 인덱스로 받게 만들면 지금 띠를 그리는
// 세 자리를 전부 다시 꿰어야 하고, 그 과정에서 연주 지지가 아닌 다른 지지를
// 넘기는 실수가 생긴다 — 띠는 반드시 **연주**의 지지다.

import { JIJI, JIJI_ANIMAL, JIJI_HANJA } from "@/lib/saju";

export type ZodiacAnimal = (typeof JIJI_ANIMAL)[number];

export interface ZodiacCharacter {
  /** 띠 이름 — computeSaju 의 animal 과 같은 표기 */
  animal: ZodiacAnimal;
  /** 지지 (자·축·인…) */
  branch: (typeof JIJI)[number];
  branchHanja: (typeof JIJI_HANJA)[number];
  /** 그림이 아직 없을 때 대신 서는 글자 */
  emoji: string;
  /**
   * 896px 투명 webp. 아직 없는 파일도 여기 적어 둔다 — 파일이 들어오는 순간
   * 켜지고, 그 전에는 hasArt 가 false 라 이모지가 대신 선다.
   */
  art: string;
}

/**
 * 파일명에 쓰는 로마자. 한글 파일명은 배포·CDN 에서 인코딩이 갈려 한 번
 * 데인 자리다 — 그림 파일은 전부 아스키로 둔다.
 */
const ROMAN = [
  "rat", "ox", "tiger", "rabbit", "dragon", "snake",
  "horse", "goat", "monkey", "rooster", "dog", "pig",
] as const;

/** 그림이 아직 없는 동안 대신 서는 글자 */
const ZODIAC_EMOJI = [
  "🐭", "🐮", "🐯", "🐰", "🐲", "🐍",
  "🐴", "🐑", "🐵", "🐔", "🐶", "🐷",
] as const;

/**
 * 십이지 순서 그대로. JIJI / JIJI_ANIMAL 과 같은 순서를 지킨다 —
 * 어긋나면 띠와 지지가 한 칸씩 밀린다.
 */
export const ZODIAC: readonly ZodiacCharacter[] = JIJI_ANIMAL.map((animal, i) => ({
  animal,
  branch: JIJI[i],
  branchHanja: JIJI_HANJA[i],
  emoji: ZODIAC_EMOJI[i],
  art: `/assets/zodiac/${ROMAN[i]}-hanbok.webp`,
}));

/**
 * 이미 그려진 띠. 그림을 새로 넣을 때마다 여기에 이름을 더한다 —
 * 파일 존재를 코드가 알 길이 없으므로, 이 집합이 사람이 관리하는 등재부다.
 *
 * 지금은 비어 있다 — 열두 장 중 아무것도 아직 없다. 토끼 그림이 이미 있긴
 * 하지만 그것은 흐름용(rabbit-*-hanbok)이라 띠 자리에 그대로 쓸 수 없다.
 * 힉스필드로 뽑는 대로 하나씩 연다 (public/assets/today/README.md 의
 * 파이프라인을 그대로 따른다 — 896px, 한복, **빈손**).
 */
export const ZODIAC_ART_READY = new Set<string>([]);

const BY_ANIMAL = new Map(ZODIAC.map((z) => [z.animal, z]));

/** 띠 이름으로 찾는다. 못 찾으면 null — 화면은 띠 없이 그린다. */
export function zodiacOf(animal: string | null | undefined): ZodiacCharacter | null {
  if (!animal) return null;
  return BY_ANIMAL.get(animal.trim() as ZodiacAnimal) ?? null;
}

/**
 * 그림이 실제로 준비된 띠인가. 아직이면 화면은 이모지로 그린다.
 *
 * 이 갈래를 두는 이유는 열두 장이 한꺼번에 오지 않기 때문이다. 없는 그림을
 * 그대로 걸면 깨진 이미지 아이콘이 뜨고, 그건 이모지보다 나쁘다.
 */
export function hasZodiacArt(animal: string | null | undefined): boolean {
  const z = zodiacOf(animal);
  return z ? ZODIAC_ART_READY.has(z.animal) : false;
}

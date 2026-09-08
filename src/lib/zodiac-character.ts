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
 * 열둘 다 그렸다 (2026-09-08). 힉스필드 nano_banana_pro 로 뽑고
 * image_background_remover 로 배경을 지운 896px 투명 webp 다.
 *
 * 띠마다 얼굴과 옷이 다르다. 화풍만 같고 표정·자세·한복 색은 겹치지 않는다 —
 * 같은 얼굴에 동물만 바꾸면 열둘이 한 마리로 읽힌다(첫 시도가 그랬다).
 *
 * 배경 제거는 반드시 힉스필드 것을 쓴다. ImageMagick 으로 흰색을 지우면
 * 돼지의 연분홍 몸통과 크림색 바지에 구멍이 뚫리고, 가장자리 flood-fill 로
 * 바꾸면 발밑 그림자가 캐릭터에 닿아 있어 남는다 — 둘 다 실제로 겪었다.
 */
export const ZODIAC_ART_READY = new Set<string>(ZODIAC.map((z) => z.animal));

const BY_ANIMAL = new Map(ZODIAC.map((z) => [z.animal, z]));

/**
 * 띠 이름으로 찾는다. 못 찾으면 null — 화면은 띠 없이 그린다.
 *
 * "토끼" 와 "토끼띠" 를 둘 다 받는다. 부르는 곳마다 형태가 다르기 때문이다 —
 * computeSaju 는 "토끼" 를 주고(saju.ts:96), 만세력은 "띠" 를 붙여 저장한다
 * (manseryeok.ts:321). 처음에 앞의 것만 받도록 만들어, 만세력 화면에서 표식이
 * 조용히 사라졌다. 접미사를 여기서 벗기면 부르는 쪽이 무엇을 넘기든 선다.
 */
export function zodiacOf(animal: string | null | undefined): ZodiacCharacter | null {
  if (!animal) return null;
  const name = animal.trim().replace(/띠$/, "");
  return BY_ANIMAL.get(name as ZodiacAnimal) ?? null;
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

// ── 관계 역할에 얹는 얼굴 ────────────────────────────────────────
//
// 사주지도의 사람 카드가 지금은 글자뿐이라, 여덟 사람이 늘어서면 무엇이
// 무엇인지 한눈에 안 갈린다. 역할마다 다른 얼굴을 세우면 이름을 읽기 전에
// 색과 생김새로 먼저 갈린다.
//
// **상대의 띠가 아니다.** 상대 생년월일은 봉인 저장이라 화면에 온 적이 없고
// (guin-db.ts), 그 규칙은 그대로 둔다. 여기 쓰는 것은 계산된 **역할**에
// 붙인 그림일 뿐이라 어떤 개인정보도 새로 꺼내지 않는다.
//
// 배정은 역할의 tagline 을 따랐다 (guin-map.ts):
//   귀인 "나를 살리는 사람"          → 용   (기운을 크게 키우는 쪽)
//   오른팔형 "현실적으로 내 편"       → 소   (묵묵히 곁에서 일하는 쪽)
//   성장형 "새 방향과 자극"          → 말   (앞으로 내달리는 쪽)
//   거울형 "나를 비춰주는"           → 토끼 (대표 캐릭터, 나에 가장 가깝다)
//   자극형 "새 방향을 열어주는"       → 호랑이(밀어붙이는 쪽)
//   안식처형 "마음을 편하게"          → 양   (곁이 순한 쪽)
//   대화형 "생각을 풀어내기 쉬운"     → 원숭이(말이 오가는 쪽)
//   동행 "결이 달라 배울 게 많은"     → 개   (나란히 걷는 쪽)
const ROLE_ANIMAL: Record<string, ZodiacAnimal> = {
  benefactor: "용",
  right_hand: "소",
  growth_teacher: "말",
  mirror: "토끼",
  stimulator: "호랑이",
  comforter: "양",
  communicator: "원숭이",
  neutral: "개",
};

/**
 * 관계 역할에 붙는 캐릭터. 모르는 역할이면 null 이고, 화면은 그림 없이 그린다 —
 * 역할이 늘었을 때 엉뚱한 얼굴이 서는 것보다 안 서는 편이 낫다.
 */
export function zodiacForRole(role: string | null | undefined): ZodiacCharacter | null {
  if (!role) return null;
  const animal = ROLE_ANIMAL[role];
  return animal ? zodiacOf(animal) : null;
}

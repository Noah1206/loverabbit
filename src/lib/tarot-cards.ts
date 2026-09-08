// 타로 — 메이저 아르카나 22장.
//
// 왜 22장으로 시작하는가.
//
// 78장에 정·역위를 곱하면 156칸이고, 질문 유형까지 곱하면 그 배수다. 그 전부를
// 사람이 써야 한다 — 이 저장소는 승인된 사실 밖의 말을 만들지 않기 때문에,
// 카드가 무엇을 뜻하는지는 모델이 아니라 이 표에서 온다.
//
// 그래서 첫 판은 **메이저 22장 정위만** 연다. 스물둘이면 표가 끝나고, 카드가
// 적으면 오히려 한 장 한 장이 또렷해진다. 돌려보고 반응이 있으면 마이너 56장과
// 역위를 채우면 되고, 없으면 스물둘만 버리면 된다.
//
// 역위를 처음부터 뺀 이유가 하나 더 있다. 역위는 "좋은 카드가 뒤집혀 나쁘다"로
// 읽히기 쉬운데, 그 판정은 이 서비스가 지키는 선(단정하지 않는다)과 부딪힌다.
// 정위만 쓰면 카드는 방향을 말하고 판정은 하지 않는다.

export interface TarotCard {
  id: string;
  /** 화면에 적는 이름 */
  name: string;
  /** 로마 숫자 — 메이저의 순서 */
  number: string;
  /** 이 카드가 무엇에 대한 것인가. 해석은 이 범위 안에서만 나온다. */
  keywords: string[];
  /**
   * 카드가 말하는 것 한 줄. 승인된 사실이다 — 해석 문장은 이 뜻 밖으로
   * 나가지 못한다.
   */
  meaning: string;
  /**
   * 이 카드로 **말하지 않는 것**. 카드마다 흔히 미끄러지는 방향을 적어 둔다 —
   * 죽음 카드에서 "누가 죽는다", 탑에서 "망한다" 같은 것.
   */
  forbidden: string[];
}

/**
 * 메이저 22장. 이름과 번호는 라이더-웨이트 표준을 따른다(공유 문화재).
 * keywords·meaning·forbidden 은 이 서비스가 쓴 것으로, 여기를 고치는 것이
 * 곧 검수다.
 */
export const MAJOR_ARCANA: TarotCard[] = [
  {
    id: "the-fool",
    name: "바보",
    number: "0",
    keywords: ["시작", "미지", "가벼움", "모험"],
    meaning: "아직 정해지지 않은 자리에 서 있는 카드예요. 앞이 안 보이는 것이 위험이 아니라 여지인 국면이에요.",
    forbidden: ["어리석다고 판정하는 말", "실패를 예고하는 말"],
  },
  {
    id: "the-magician",
    name: "마법사",
    number: "I",
    keywords: ["의지", "자원", "실행", "시작하는 힘"],
    meaning: "필요한 것이 이미 손에 있는 국면이에요. 없어서 못 하는 게 아니라 아직 쓰지 않은 쪽에 가까워요.",
    forbidden: ["반드시 성공한다는 말", "능력을 단정하는 말"],
  },
  {
    id: "the-high-priestess",
    name: "여사제",
    number: "II",
    keywords: ["직관", "침묵", "숨은 것", "기다림"],
    meaning: "아직 드러나지 않은 것이 있는 국면이에요. 말로 꺼내기 전에 안에서 정리되는 시기예요.",
    forbidden: ["숨은 사실을 알아냈다고 하는 말", "상대의 속을 단정하는 말"],
  },
  {
    id: "the-empress",
    name: "여황제",
    number: "III",
    keywords: ["풍요", "돌봄", "감각", "키워냄"],
    meaning: "무언가를 기르고 채우는 자리예요. 결과를 재촉하기보다 자라는 시간을 주는 쪽이 맞는 국면이에요.",
    forbidden: ["임신·출산을 예고하는 말", "재물의 액수를 말하는 것"],
  },
  {
    id: "the-emperor",
    name: "황제",
    number: "IV",
    keywords: ["질서", "책임", "경계", "구조"],
    meaning: "틀이 필요한 국면이에요. 느슨하게 두었던 것에 선을 긋는 쪽으로 힘이 실려요.",
    forbidden: ["권위에 복종하라는 말", "특정 인물을 지목하는 말"],
  },
  {
    id: "the-hierophant",
    name: "교황",
    number: "V",
    keywords: ["배움", "조언", "전통", "규범"],
    meaning: "이미 있는 방식에서 답을 찾는 국면이에요. 혼자 새로 만들기보다 물어보는 쪽이 빨라요.",
    forbidden: ["종교를 권하는 말", "따라야 한다고 명령하는 말"],
  },
  {
    id: "the-lovers",
    name: "연인",
    number: "VI",
    keywords: ["선택", "끌림", "결합", "가치"],
    meaning: "둘 사이에서 하나를 고르는 자리예요. 감정만이 아니라 무엇을 중히 여기는지가 걸리는 국면이에요.",
    forbidden: ["연애가 이뤄진다는 말", "그 사람이 맞다고 판정하는 말"],
  },
  {
    id: "the-chariot",
    name: "전차",
    number: "VII",
    keywords: ["추진", "방향", "돌파", "통제"],
    meaning: "밀고 나가는 힘이 도는 국면이에요. 다만 방향을 쥐고 있어야 그 힘이 쓰여요.",
    forbidden: ["승리한다는 말", "이긴다·진다는 판정"],
  },
  {
    id: "strength",
    name: "힘",
    number: "VIII",
    keywords: ["인내", "부드러움", "다스림", "용기"],
    meaning: "세게 누르기보다 오래 견디는 쪽이 통하는 국면이에요. 급한 힘보다 꾸준한 힘이 맞아요.",
    forbidden: ["참으라고 강요하는 말", "고통을 미화하는 말"],
  },
  {
    id: "the-hermit",
    name: "은둔자",
    number: "IX",
    keywords: ["성찰", "거리두기", "홀로", "탐구"],
    meaning: "잠시 물러나 보는 자리예요. 사람 속에서 답이 안 나오면 혼자 두는 시간이 필요한 국면이에요.",
    forbidden: ["외로움을 예고하는 말", "관계를 끊으라는 말"],
  },
  {
    id: "wheel-of-fortune",
    name: "운명의 수레바퀴",
    number: "X",
    keywords: ["전환", "순환", "시기", "흐름"],
    meaning: "판이 도는 국면이에요. 지금 모양이 그대로 이어지지는 않는 자리예요.",
    forbidden: ["운명이라고 못 박는 말", "시점을 날짜로 말하는 것"],
  },
  {
    id: "justice",
    name: "정의",
    number: "XI",
    keywords: ["균형", "판단", "인과", "공정"],
    meaning: "해 온 것이 셈으로 돌아오는 국면이에요. 감정보다 사실이 무게를 갖는 자리예요.",
    forbidden: ["법적 판단", "누가 옳고 그른지 판정하는 말"],
  },
  {
    id: "the-hanged-man",
    name: "매달린 사람",
    number: "XII",
    keywords: ["멈춤", "유예", "관점 전환"],
    meaning: "지금은 움직이는 때가 아닌 국면이에요. 보는 각도를 바꾸면 다르게 보이는 자리예요.",
    forbidden: ["희생하라는 말", "포기를 권하는 말"],
  },
  {
    id: "death",
    name: "죽음",
    number: "XIII",
    keywords: ["끝맺음", "변화", "다음 단계"],
    meaning: "한 장이 닫히는 국면이에요. 없어지는 것이 아니라 모양이 바뀌는 자리예요.",
    forbidden: ["죽음·사망을 뜻한다는 말", "관계가 끝난다는 단정", "건강 악화를 예고하는 말"],
  },
  {
    id: "temperance",
    name: "절제",
    number: "XIV",
    keywords: ["조율", "중용", "섞임", "회복"],
    meaning: "양쪽을 섞어 알맞은 지점을 찾는 국면이에요. 한쪽으로 몰지 않는 것이 답인 자리예요.",
    forbidden: ["금욕을 권하는 말", "치료·회복을 약속하는 말"],
  },
  {
    id: "the-devil",
    name: "악마",
    number: "XV",
    keywords: ["집착", "얽매임", "욕망", "반복"],
    meaning: "알면서도 놓지 못하는 것이 있는 국면이에요. 묶인 쪽이 바깥이 아니라 안일 수 있는 자리예요.",
    forbidden: ["중독이라고 진단하는 말", "상대를 나쁜 사람으로 판정하는 말"],
  },
  {
    id: "the-tower",
    name: "탑",
    number: "XVI",
    keywords: ["붕괴", "갑작스러움", "드러남"],
    meaning: "쌓아 둔 것이 한 번에 흔들리는 국면이에요. 무너지는 자리에서 가려져 있던 것이 보이기도 해요.",
    forbidden: ["사고·재난을 예고하는 말", "망한다는 단정", "금전 손실을 예고하는 말"],
  },
  {
    id: "the-star",
    name: "별",
    number: "XVII",
    keywords: ["희망", "회복", "방향", "치유"],
    meaning: "흔들린 뒤에 다시 방향이 잡히는 국면이에요. 크게 밝지 않아도 길이 보이는 자리예요.",
    forbidden: ["잘 될 거라고 약속하는 말", "치유를 보장하는 말"],
  },
  {
    id: "the-moon",
    name: "달",
    number: "XVIII",
    keywords: ["불안", "흐릿함", "무의식", "착시"],
    meaning: "보이는 것과 실제가 어긋나기 쉬운 국면이에요. 지금 느끼는 것이 전부는 아닌 자리예요.",
    forbidden: ["거짓말을 하고 있다는 판정", "정신 건강을 진단하는 말"],
  },
  {
    id: "the-sun",
    name: "태양",
    number: "XIX",
    keywords: ["명료", "활력", "드러남", "기쁨"],
    meaning: "가려져 있던 것이 또렷해지는 국면이에요. 숨기지 않아도 되는 자리예요.",
    forbidden: ["행복을 약속하는 말", "성공을 예고하는 말"],
  },
  {
    id: "judgement",
    name: "심판",
    number: "XX",
    keywords: ["결산", "각성", "재개", "부름"],
    meaning: "지나온 것을 한 번 정리하고 다시 시작하는 국면이에요. 미뤄 둔 답을 내는 자리예요.",
    forbidden: ["심판·처벌을 뜻한다는 말", "옳고 그름을 판정하는 말"],
  },
  {
    id: "the-world",
    name: "세계",
    number: "XXI",
    keywords: ["완결", "통합", "도달", "한 바퀴"],
    meaning: "한 바퀴가 닫히는 국면이에요. 다음이 없다는 뜻이 아니라 이 장이 마무리된다는 자리예요.",
    forbidden: ["목표 달성을 약속하는 말", "끝났다고 단정하는 말"],
  },
];

export const CARD_MAP = new Map(MAJOR_ARCANA.map((c) => [c.id, c]));

/** 카드 id 로 찾는다. 없으면 null — 화면은 그 자리를 비운다. */
export function cardOf(id: string | null | undefined): TarotCard | null {
  if (!id) return null;
  return CARD_MAP.get(id) ?? null;
}

/**
 * 세 장 뽑기.
 *
 * 왜 서버가 뽑는가. 화면이 뽑으면 새로고침으로 원하는 카드가 나올 때까지 다시
 * 뽑을 수 있다 — 그건 타로가 아니라 뽑기다. 뽑은 결과는 서버가 정하고
 * 저장한다.
 *
 * `rand` 를 밖에서 넣을 수 있게 둔 것은 검사 때문이다. 실제 호출은 넣지 않고
 * Math.random 을 쓴다.
 */
export function drawThree(rand: () => number = Math.random): TarotCard[] {
  const pool = [...MAJOR_ARCANA];
  const picked: TarotCard[] = [];
  for (let i = 0; i < 3; i += 1) {
    const idx = Math.floor(rand() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/** 세 자리의 뜻 — 뽑은 카드가 어느 자리에 놓였는지가 해석을 가른다 */
export const SPREAD_POSITIONS = [
  { key: "past", label: "지나온 자리", note: "여기까지 무엇이 있었는가" },
  { key: "present", label: "지금 자리", note: "지금 어디에 서 있는가" },
  { key: "advice", label: "가져갈 것", note: "이 국면에서 무엇을 쥐면 되는가" },
] as const;

export type SpreadPosition = (typeof SPREAD_POSITIONS)[number]["key"];

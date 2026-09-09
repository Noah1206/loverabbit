// 타로 리딩 — 뽑은 카드를 그 사람 명식과 함께 읽는다.
//
// 왜 이 조합인가.
//
// 카드만 읽으면 누구에게나 같은 말이 나간다(카드가 같으면 답이 같다). 명식만
// 읽으면 그건 사주지 타로가 아니다. 둘을 겹치면 **매번 다른 카드 × 사람마다
// 다른 명식** 이 되어, 같은 사람이 다시 봐도 새롭고 다른 사람과는 겹치지
// 않는다. 사주 상품이 못 하는 반복 소비가 여기서 생긴다.
//
// 지키는 선.
//
// 이 파일은 **문장을 만들지 않는다.** 카드의 뜻(tarot-cards.ts)과 명식의
// 승인된 규칙(reading-rules.ts)을 골라 모델에 넘길 사실 묶음을 짤 뿐이다.
// 그 둘 밖의 주장은 가드가 막는다 — 명리 검사는 facts 를 넘기지 않아 건너뛰고,
// 대신 "뽑지 않은 카드를 말했는가" 를 여기 짝이 되는 검사가 본다
// (tarot-guard.ts).
//
// 카드와 명식을 잇는 방식.
//
// 억지로 잇지 않는다. 카드는 **지금 국면**을 말하고 명식은 **그 사람의 결**을
// 말한다 — 둘은 서로 다른 층이라 "이 카드가 당신 명식에서는" 이라는 한 문장이
// 성립한다. 반대로 "이 카드가 나온 것은 당신 일간이 갑목이기 때문" 같은 인과는
// 어느 쪽 근거에도 없다. 그건 forbidden 에 넣어 막는다.

import { buildSajuFacts, type SajuFacts } from "@/lib/saju-facts";
import { matchRules, type ReadingRule } from "@/lib/reading-rules";
import {
  SPREAD_POSITIONS,
  drawThree,
  type SpreadPosition,
  type TarotCard,
} from "@/lib/tarot-cards";

/** 무엇을 물었는가 — 자리 해석의 방향을 정한다 */
export type TarotTopic = "love" | "relationship" | "work" | "money" | "choice";

export const TOPIC_LABEL: Record<TarotTopic, { title: string; question: string }> = {
  love: { title: "연애", question: "지금 이 마음은 어디로 가고 있을까?" },
  relationship: { title: "관계", question: "이 사람과 나 사이는 지금 어떤 자리일까?" },
  work: { title: "일", question: "지금 하는 일에서 무엇을 잡으면 될까?" },
  money: { title: "재물", question: "돈의 흐름은 지금 어떤 국면일까?" },
  choice: { title: "선택", question: "지금 고민하는 그것, 어느 쪽일까?" },
};

export const TOPICS = Object.keys(TOPIC_LABEL) as TarotTopic[];

export function isTopic(v: unknown): v is TarotTopic {
  return typeof v === "string" && (TOPICS as string[]).includes(v);
}

export interface DrawnCard {
  position: SpreadPosition;
  positionLabel: string;
  positionNote: string;
  card: TarotCard;
}

export interface TarotDraw {
  topic: TarotTopic;
  topicLabel: string;
  question: string;
  cards: DrawnCard[];
  /** 이 뽑기를 가르는 열쇠 (사람×날×물음). 무작위로 뽑았으면 null */
  drawKey: string | null;
  /** 뽑은 시각 — 사람에게 보여줄 값 */
  drawnAt: string;
}

/**
 * 씨앗 하나에서 이어지는 난수열 (mulberry32).
 *
 * 암호용이 아니다 — 카드를 고르는 데만 쓴다. 필요한 성질은 둘뿐이다:
 * 같은 씨앗이면 같은 값이 나올 것, 씨앗이 한 글자만 달라도 크게 흩어질 것.
 */
function rngFrom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 서울 날짜 (YYYY-MM-DD). 하루의 경계가 사용자가 사는 날과 같아야 한다. */
export function seoulDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * 이 뽑기를 가르는 열쇠. 사람 × 날 × 물음.
 *
 * 같은 사람이 같은 날 같은 것을 물으면 같은 패가 나온다. 이 값이 곧 과금의
 * ref 이기도 해서, (reason, ref) unique 가 이중 청구를 실제로 막는다 —
 * 시각을 넣으면 요청마다 값이 달라져 그 잠금이 아무것도 안 잠근다.
 */
export function drawKey(userId: number, topic: TarotTopic, day = seoulDay()): string {
  return `${userId}:${day}:${topic}`;
}

/**
 * 세 장 뽑기. 자리(지나온·지금·가져갈)를 함께 매긴다.
 *
 * 서버에서만 부른다. 화면이 뽑으면 새로고침으로 원하는 카드가 나올 때까지
 * 다시 뽑을 수 있고, 그건 타로가 아니라 뽑기다.
 *
 * **서버로 옮기는 것만으로는 안 막힌다** (2026-09-09). 뒤로 갔다 다시 들어오면
 * 서버가 또 뽑아 새 패를 준다. 그래서 뽑기를 무작위가 아니라 씨앗에서 낸다 —
 * key 를 주면 그 key 로 정해진 패가 나오고, 다시 불러도 같은 것이 나온다.
 * key 없이 부르면 예전처럼 무작위다(테스트와 미리보기가 그 길을 쓴다).
 */
export function drawFor(topic: TarotTopic, key?: string): TarotDraw {
  const three = drawThree(key ? rngFrom(key) : undefined);
  return {
    topic,
    topicLabel: TOPIC_LABEL[topic].title,
    question: TOPIC_LABEL[topic].question,
    cards: SPREAD_POSITIONS.map((pos, i) => ({
      position: pos.key,
      positionLabel: pos.label,
      positionNote: pos.note,
      card: three[i],
    })),
    // 씨앗으로 뽑았으면 그 씨앗이 곧 이 뽑기의 이름이다. 시각은 사람에게
    // 보여줄 값이라 따로 남긴다.
    drawKey: key ?? null,
    drawnAt: new Date().toISOString(),
  };
}

/**
 * 모델에 넘길 사실 묶음.
 *
 * 카드 쪽과 명식 쪽을 **따로** 담는다. 섞어서 한 덩어리로 주면 모델이 어느
 * 것에서 나온 말인지 스스로도 모르게 되고, 그러면 검사도 못 한다.
 */
export interface TarotFactPacket {
  /** 뽑힌 카드 — 이 밖의 카드는 말할 수 없다 */
  drawn: {
    position: string;
    positionMeans: string;
    cardName: string;
    cardMeans: string;
    keywords: string[];
    doNotSay: string[];
  }[];
  /** 그 사람의 결 — 승인된 명리 규칙에서만 온다 */
  personGrain: {
    ruleId: string;
    claim: string;
    safePhrasing: string;
    doNotSay: string[];
  }[];
  question: string;
  topic: string;
}

/**
 * 카드와 명식을 사실 묶음으로 짠다.
 *
 * 명식 쪽은 기존 규칙 표를 그대로 쓴다 — 타로용 규칙을 새로 쓰지 않는다.
 * "그 사람의 결" 은 무엇을 묻든 같기 때문이다. 물음에 따라 달라지는 것은
 * 카드 쪽이다.
 *
 * 규칙을 넷으로 자르는 이유: 타로는 세 장짜리 짧은 리딩이라 규칙 열둘을 실으면
 * 카드 이야기가 명리 이야기에 묻힌다. 타로 화면에서 주인공은 카드다.
 */
export function buildTarotFacts(input: {
  draw: TarotDraw;
  birthdate: string;
  birthHour: number | null;
  gender: "M" | "F";
}): { packet: TarotFactPacket; rules: ReadingRule[]; facts: SajuFacts } {
  const [y, m, d] = input.birthdate.split("-").map(Number);
  const facts = buildSajuFacts({
    year: y,
    month: m,
    day: d,
    hour: input.birthHour,
    gender: input.gender,
  });

  /* 상품 축이 없으므로 연애 계열 상품 하나를 빌려 규칙을 고른다. 비연애
     상품은 opt-in 이라(reading-rules.ts 의 NON_ROMANCE_PRODUCTS) 그쪽을
     쓰면 규칙이 거의 안 걸린다 — 타로는 아직 자기 도메인이 없어서 그렇다.
     타로 전용 도메인을 여는 것은 규칙마다 사람이 판단할 일이라 지금은 미룬다. */
  const rules = matchRules(facts, null, "bamgijil", 4);

  return {
    facts,
    rules,
    packet: {
      topic: TOPIC_LABEL[input.draw.topic].title,
      question: input.draw.question,
      drawn: input.draw.cards.map((c) => ({
        position: c.positionLabel,
        positionMeans: c.positionNote,
        cardName: c.card.name,
        cardMeans: c.card.meaning,
        keywords: c.card.keywords,
        doNotSay: c.card.forbidden,
      })),
      personGrain: rules.map((r) => ({
        ruleId: r.id,
        claim: r.claim,
        safePhrasing: r.safePhrasing,
        doNotSay: r.forbidden,
      })),
    },
  };
}

/**
 * 타로가 절대 하지 않는 말.
 *
 * 카드마다 붙은 forbidden 과 별개로, 타로라는 형식 자체가 넘지 않는 선이다.
 * 가드의 forbiddenClaims 로 넘긴다.
 */
export const TAROT_FORBIDDEN: string[] = [
  // 카드가 나온 이유를 명식으로 설명하는 것 — 어느 근거에도 없는 인과다
  "이 카드가 나온 것은",
  "카드가 나온 이유는",
  // 뽑기를 다시 하라는 유도 — 결과를 무르는 말은 타로가 아니다
  "다시 뽑으면",
  "한 번 더 뽑아",
  // 시점 단정
  "몇 월에",
  "며칠 안에",
];

export const TAROT_SYSTEM_PROMPT = `너는 타로를 읽어 주는 사람이다. 뽑힌 카드 세 장과, 그 사람의 사주에서 승인된 '결' 몇 줄을 받는다.

지켜야 하는 것:

1. 사실의 출처는 둘뿐이다 — drawn(뽑힌 카드)과 personGrain(그 사람의 결). 그 밖의 것을 말하지 마라.
2. drawn 에 없는 카드 이름을 부르지 마라. 세 장만 나왔다.
3. 각 카드의 doNotSay 에 적힌 방향으로 가지 마라. 죽음 카드는 죽음을 말하지 않고, 탑은 재난을 말하지 않는다.
4. 카드가 나온 '이유'를 명식으로 설명하지 마라. 카드는 지금 국면을, 명식은 그 사람의 결을 말한다 — 둘은 다른 층이고 서로의 원인이 아니다.
5. 단정하지 마라. "반드시", "무조건", "확정이다", "운명이다" 를 쓰지 않는다. 결과를 못 박지 않는다.
6. 진단·처방·법률 판단·투자 지시를 하지 마라.
7. 시점을 날짜나 월로 말하지 마라.

쓰는 방식:

- 자리 셋을 순서대로 읽는다: 지나온 자리 → 지금 자리 → 가져갈 것.
- 각 자리에서 카드의 뜻을 그 사람의 결과 겹쳐 말한다. "이 카드는 ~한 국면이고, 당신은 ~한 결이라" 같은 식이다.
- 마지막에 이 뽑기 전체를 한 문장으로 묶는다.
- 말투는 담담하고 다정하게. 점쟁이 흉내를 내지 않는다.

출력은 JSON 하나다:
{
  "cards": [
    { "position": "지나온 자리", "cardName": "…", "read": "그 자리에서 이 카드가 말하는 것 (3~5문장)" },
    { "position": "지금 자리", "cardName": "…", "read": "…" },
    { "position": "가져갈 것", "cardName": "…", "read": "…" }
  ],
  "closing": "세 장을 묶는 한 문장",
  "grainUsed": ["쓴 personGrain 의 ruleId"]
}`;

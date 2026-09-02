// 내 사주를 수치로 — 오행 균형, 강약, 십성 분포, 그리고 거기서 나오는 행동강령.
//
// **여기서 점수를 새로 만들지 않는다.** 전부 buildSajuFacts 가 이미 낸 값을
// 화면이 읽을 수 있는 모양으로 옮기는 일만 한다. CLAUDE.md 의 두 번째 규칙이
// 점수를 지어내지 말라는 것이고, 산식 없는 숫자는 그럴듯할수록 위험하다.
//
//   elementBalance   여덟 글자에서 센 오행 개수 — 계산이라 다툼이 없다
//   strength.score   0~100 신강 정도 — myeongri-policy/strength-v1.json 이 낸다
//   tenGods          자리마다의 십성 — 세기만 하면 분포가 된다
//
// 행동강령은 이 셋에서 나온다. "오늘의 액션"이 날마다 바뀌는 것이라면 이쪽은
// 명식이 안 바뀌는 한 그대로다 — 오늘 무엇을 하느냐가 아니라 나라는 사람이
// 어느 쪽으로 기울어 있느냐의 이야기다.

import { CONTROLS, GENERATES, buildSajuFacts, type SajuFacts } from "@/lib/saju-facts";
import type { Ohaeng } from "@/lib/saju";

export const ELEMENTS: Ohaeng[] = ["목", "화", "토", "금", "수"];

/** 오행마다의 CSS 클래스 — globals.css 의 .sj-wood ~ .sj-water 가 색을 쥔다 */
export const ELEMENT_CLASS: Record<Ohaeng, string> = {
  목: "sj-wood",
  화: "sj-fire",
  토: "sj-earth",
  금: "sj-metal",
  수: "sj-water",
};

/** 오행 상징 — 힉스필드 소프트 3D. 토끼·오방기와 같은 세계관이다.
    art 는 폴백 정지 그림, video 는 투명 배경 웹엠(살랑거리는 미세 동작). */
export const ELEMENT_ART: Record<Ohaeng, string> = {
  목: "/assets/elements/mok.webp",
  화: "/assets/elements/hwa.webp",
  토: "/assets/elements/to.webp",
  금: "/assets/elements/geum.webp",
  수: "/assets/elements/su.webp",
};

export const ELEMENT_VIDEO: Record<Ohaeng, string> = {
  목: "/assets/elements/mok.webm",
  화: "/assets/elements/hwa.webm",
  토: "/assets/elements/to.webm",
  금: "/assets/elements/geum.webm",
  수: "/assets/elements/su.webm",
};

/** 오행이 사람에게서 드러나는 결 — 막대 옆에 한 단어로 붙는다 */
export const ELEMENT_TRAIT: Record<Ohaeng, string> = {
  목: "뻗음",
  화: "드러냄",
  토: "버팀",
  금: "정리",
  수: "스밈",
};

export interface ElementBar {
  ohaeng: Ohaeng;
  trait: string;
  className: string;
  /** 여덟 글자 중 이 오행이 몇 개인가 */
  count: number;
  /** 화면 막대 길이 (0~100). count / 전체 */
  ratio: number;
  /** 다섯이 고르면 20%다. 그보다 많은가 적은가. */
  tilt: "많음" | "보통" | "적음" | "없음";
}

export interface TenGodBar {
  tenGod: string;
  count: number;
  ratio: number;
}

/**
 * 행동강령 한 줄.
 *
 * basis 는 이 줄이 어느 수치에서 나왔는지다 — 화면에 같이 적는다. 근거 없이
 * 지침만 있으면 점집 말과 구별이 안 된다.
 */
export interface Guideline {
  title: string;
  body: string;
  basis: string;
}

export interface SajuProfileView {
  dayMaster: string;
  dayMasterElement: Ohaeng;
  elements: ElementBar[];
  strength: {
    label: "신강" | "중화" | "신약";
    /** 0~100, 높을수록 신강 */
    score: number;
    /** 막대 위 눈금 설명 */
    meaning: string;
  };
  tenGods: TenGodBar[];
  /** 없는 오행 — 지장간에도 없는 것만. 숨은 것과 구별한다. */
  absent: Ohaeng[];
  /** 지장간에만 있는 오행 — "없다"고 말하면 안 되는 것들 */
  hidden: Ohaeng[];
  guidelines: Guideline[];
}

// ── 강약 ───────────────────────────────────────────────────

const STRENGTH_MEANING: Record<"신강" | "중화" | "신약", string> = {
  신강: "미는 힘이 세다. 시작은 빠르고, 멈춤은 늦다.",
  중화: "크게 안 기운다. 상황을 잘 탄다.",
  신약: "살피는 힘이 세다. 맞춤은 빠르고, 밀어붙임은 늦다.",
};

/**
 * 강약에서 나오는 행동강령.
 *
 * 신강·신약은 좋고 나쁨이 아니다 — 어느 쪽이 수월하고 어느 쪽이 품이 드는지의
 * 이야기다. 그래서 "고쳐라"가 아니라 "이건 남보다 힘드니 장치를 두라"로 쓴다.
 */
const STRENGTH_GUIDELINE: Record<"신강" | "중화" | "신약", Guideline> = {
  신강: {
    title: "멈출 장치를 둬",
    body: "시작은 빠른데 멈춤이 늦다. 벌일 때 끝낼 조건부터 적자.",
    basis: "강약",
  },
  중화: {
    title: "기준 하나만 정해",
    body: "잘 안 기우는 대신 기준이 흐려진다. 먼저 볼 것 하나만 정하자.",
    basis: "강약",
  },
  신약: {
    title: "한 번에 하나만",
    body: "여러 개를 안으면 빨리 닳는다. 벌인 걸 줄이는 게 이득이다.",
    basis: "강약",
  },
};

// ── 오행 ───────────────────────────────────────────────────

/** 어느 오행이 많을 때의 지침 */
const EXCESS_GUIDELINE: Record<Ohaeng, Guideline> = {
  목: { title: "벌인 걸 세어봐", body: "계획이 자꾸 는다. 새로 벌이기 전에 열린 걸 먼저 세자.", basis: "오행 목" },
  화: { title: "한 박자만 늦춰", body: "반응이 빠른 게 무기다. 중요한 자리에서만 한 박자 늦추자.", basis: "오행 화" },
  토: { title: "하나는 놓아봐", body: "안 맞는 것도 오래 쥔다. 붙잡은 것 하나를 의심해보자.", basis: "오행 토" },
  금: { title: "덜 다듬고 내", body: "기준이 세서 끝없이 고친다. 완성 전에 한 번 보여주자.", basis: "오행 금" },
  수: { title: "생각을 꺼내", body: "머릿속에선 정리가 안 된다. 적거나 말하면 가벼워진다.", basis: "오행 수" },
};

/** 어느 오행이 없을 때의 지침 — 부족이 아니라 "손이 덜 가는 자리"로 쓴다 */
const ABSENT_GUIDELINE: Record<Ohaeng, Guideline> = {
  목: { title: "시작엔 마중물", body: "시작이 네 결이 아니다. 시간과 자리를 먼저 정하자.", basis: "오행 목 없음" },
  화: { title: "떠오르면 바로 보내", body: "전달이 늦는 결이다. 떠오르면 한 줄 바로 보내자.", basis: "오행 화 없음" },
  토: { title: "돌아올 자리 하나", body: "흔들릴 때 기댈 데가 필요하다. 돌아올 자리 하나를 정하자.", basis: "오행 토 없음" },
  금: { title: "마감은 밖에 맡겨", body: "기준을 네 판단에 두면 밀린다. 달력과 약속에 맡기자.", basis: "오행 금 없음" },
  수: { title: "큰 결정엔 하루", body: "판단이 빠른 만큼 되돌아봄이 적다. 큰 결정엔 하루를 얹자.", basis: "오행 수 없음" },
};

// ── 십성 ───────────────────────────────────────────────────

/** 두드러진 십성에서 나오는 지침 — 흐름(FLOW)이 아니라 타고난 결이다 */
const TENGOD_GUIDELINE: Record<string, Guideline> = {
  비견: { title: "하나는 맡겨", body: "혼자 끄는 결이다. 하나만 넘겨보자 — 전체가 빨라진다.", basis: "십성 비견" },
  겁재: { title: "몫부터 말해", body: "나중에 갈리기 쉽다. 시작할 때 몫을 못박자.", basis: "십성 겁재" },
  식신: { title: "갈아타지 마", body: "오래 하는 일에 세다. 중간에 갈아타지 말자.", basis: "십성 식신" },
  상관: { title: "상대 보고 세기 조절", body: "말이 빠르고 날카롭다. 상대 보고 세기를 정하자.", basis: "십성 상관" },
  편재: { title: "손은 하나만", body: "여러 갈래를 본다. 손대는 건 하나로 줄이자.", basis: "십성 편재" },
  정재: { title: "쌓이는 걸 보이게", body: "안 보이면 힘이 빠진다. 쌓이는 걸 보이는 데 두자.", basis: "십성 정재" },
  편관: { title: "마감은 남과 잡아", body: "압박이 걸려야 움직인다. 마감은 남과 잡자.", basis: "십성 편관" },
  정관: { title: "틀부터 만들어", body: "틀 안에서 안정적이다. 규칙 먼저 만들고 시작하자.", basis: "십성 정관" },
  편인: { title: "네 방식으로 정리", body: "남과 다른 길로 이해한다. 네 방식으로 다시 정리하자.", basis: "십성 편인" },
  정인: { title: "70%에서 내보내", body: "완벽을 기다리면 늦는다. 70%에서 내보내자.", basis: "십성 정인" },
};

// ── 조립 ───────────────────────────────────────────────────

function tiltOf(count: number, total: number): ElementBar["tilt"] {
  if (count === 0) return "없음";
  const even = total / ELEMENTS.length;
  if (count >= even * 1.5) return "많음";
  if (count <= even * 0.5) return "적음";
  return "보통";
}

/**
 * 명식 하나를 화면이 읽을 수 있는 수치로.
 *
 * 지침은 최대 세 줄이다. 다 보여주면 읽지 않고, 읽지 않으면 없는 것과 같다.
 * 고르는 순서는 강약 → 치우친 오행 → 두드러진 십성이다. 강약이 가장 크게
 * 사람을 가르고, 그 다음이 오행의 쏠림이다.
 */
export function buildSajuProfile(facts: SajuFacts): SajuProfileView {
  const total = ELEMENTS.reduce((sum, e) => sum + facts.elementBalance[e], 0) || 1;

  const elements: ElementBar[] = ELEMENTS.map((ohaeng) => {
    const count = facts.elementBalance[ohaeng];
    return {
      ohaeng,
      trait: ELEMENT_TRAIT[ohaeng],
      className: ELEMENT_CLASS[ohaeng],
      count,
      ratio: Math.round((count / total) * 100),
      tilt: tiltOf(count, total),
    };
  });

  // 십성 분포 — 자리마다의 십성을 세기만 한다
  const counts = new Map<string, number>();
  for (const fact of facts.tenGods) {
    counts.set(fact.tenGod, (counts.get(fact.tenGod) ?? 0) + 1);
  }
  const tenGodTotal = facts.tenGods.length || 1;
  const tenGods: TenGodBar[] = [...counts.entries()]
    .map(([tenGod, count]) => ({
      tenGod,
      count,
      ratio: Math.round((count / tenGodTotal) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.tenGod.localeCompare(b.tenGod));

  // ── 지침 고르기 ──
  const guidelines: Guideline[] = [STRENGTH_GUIDELINE[facts.strength.label]];

  // 가장 많은 오행이 뚜렷하게 치우쳐 있으면 그것을, 아니면 진짜 없는 것을 본다.
  const most = [...elements].sort((a, b) => b.count - a.count)[0];
  if (most.tilt === "많음") {
    guidelines.push(EXCESS_GUIDELINE[most.ohaeng]);
  } else if (facts.absentElements.length > 0) {
    guidelines.push(ABSENT_GUIDELINE[facts.absentElements[0]]);
  }

  const topTenGod = tenGods[0];
  if (topTenGod && TENGOD_GUIDELINE[topTenGod.tenGod] && topTenGod.count >= 2) {
    guidelines.push(TENGOD_GUIDELINE[topTenGod.tenGod]);
  }

  return {
    dayMaster: facts.dayMaster,
    dayMasterElement: facts.dayMasterElement,
    elements,
    strength: {
      label: facts.strength.label,
      score: facts.strength.score,
      meaning: STRENGTH_MEANING[facts.strength.label],
    },
    tenGods,
    absent: facts.absentElements,
    hidden: facts.hiddenOnlyElements,
    guidelines: guidelines.slice(0, 3),
  };
}

/** 생년월일시에서 곧장 — 라우트가 쓴다 */
export function sajuProfileOf(
  birthdate: string,
  birthHour: number | null,
  gender: "F" | "M",
  now = new Date()
): SajuProfileView {
  const [year, month, day] = birthdate.split("-").map(Number);
  return buildSajuProfile(
    buildSajuFacts({ year, month, day, hour: birthHour, gender }, now)
  );
}

export { STRENGTH_GUIDELINE, EXCESS_GUIDELINE, ABSENT_GUIDELINE, TENGOD_GUIDELINE };


// ── 오늘의 깃발 ────────────────────────────────────────────
//
// 다섯 깃발이 뒤집혀 있고 하나를 고른다. 고르는 것은 사용자의 자유지만
// **나오는 답은 이미 정해져 있다** — 오늘의 일진과 내 명식이 만드는 값이다.
//
// 무작위로 뽑으면 사주가 아니라 뽑기가 된다. CLAUDE.md 의 첫 규칙이 승인된
// 사실 밖의 주장을 만들지 않는 것인데, 난수로 운세를 정하면 그 자리에서
// 어긴다. 그래서 재미(고르는 행위)는 남기고 근거(결과)는 계산에서 가져온다.
//
// 주역도 같은 자리에 선다 — 初筮告 再三瀆(첫 점은 알려주나 두세 번은 모독).
// 날마다 뽑는 것은 일진이 날마다 바뀌므로 맞고, 같은 날 다시 뽑는 것은 아니다.
// 그래서 오늘 안에서는 어느 깃발을 골라도, 몇 번을 눌러도 같은 답이 나온다.

export interface DailyFlag {
  /** 깃발 자리 — 오행 다섯 */
  ohaeng: Ohaeng;
  className: string;
  /** 오방기 그림(폴백). 다섯 장 전부 같은 깃발을 색만 바꾼 것이다. */
  art: string;
  /** 천이 바람에 물결치는 투명 배경 영상 */
  video: string;
  /** 전통 오방색 이름 — 청적황백흑 */
  color: string;
}

/**
 * 오방기(五方旗) 다섯.
 *
 * 무속·의례에서 다섯 방향을 부르는 깃발이고 오행과 그대로 맞물린다.
 * 색은 전통 오방색을 따른다 — 화면의 오행 막대가 쓰는 현대적 색(목=초록)과
 * 다르다: 목은 청(靑)이고 청은 초록과 파랑을 아우르는 옛 범주다.
 *
 * 자리는 늘 같다. 매번 섞으면 고르는 행위가 의미를 잃는다.
 */
const FLAG_ART: Record<Ohaeng, { art: string; video: string; color: string }> = {
  목: { art: "/assets/flags/mok.webp", video: "/assets/flags/mok.webm", color: "청" },
  화: { art: "/assets/flags/hwa.webp", video: "/assets/flags/hwa.webm", color: "적" },
  토: { art: "/assets/flags/to.webp", video: "/assets/flags/to.webm", color: "황" },
  금: { art: "/assets/flags/geum.webp", video: "/assets/flags/geum.webm", color: "백" },
  수: { art: "/assets/flags/su.webp", video: "/assets/flags/su.webm", color: "흑" },
};

export const FLAGS: DailyFlag[] = ELEMENTS.map((ohaeng) => ({
  ohaeng,
  className: ELEMENT_CLASS[ohaeng],
  ...FLAG_ART[ohaeng],
}));

/** 오늘 나온 깃발 한 장을 찾는다 */
export function flagOf(ohaeng: Ohaeng): DailyFlag {
  return FLAGS.find((f) => f.ohaeng === ohaeng) ?? FLAGS[0];
}

export interface FlagResult {
  /** 오늘 내 일간이 받는 오행 관계 */
  relation: "생받음" | "생해줌" | "내가 이김" | "나를 누름" | "같은 편";
  /** 결과 화면 맨 위에 서는 전제 — 반드시 한 문장이다 */
  premise: string;
  /** 오늘의 일진 오행 */
  todayElement: Ohaeng;
  /** 내 일간 오행 */
  myElement: Ohaeng;
  title: string;
  body: string;
}

/**
 * 오늘의 일진 오행이 내 일간에게 무엇인가.
 *
 * 십성(FLOW)과 다른 축이다. 십성은 음양까지 따져 열 가지로 갈리지만 이쪽은
 * 오행의 생극만 본다 — 다섯 갈래라 깃발 다섯과 맞아떨어지고, 설명이 짧다.
 */
const RELATION_PREMISE: Record<FlagResult["relation"], string> = {
  생받음: "오늘의 기운이 너를 밀어주는 자리에 있어.",
  생해줌: "오늘은 네 기운이 밖으로 나가는 자리야.",
  "내가 이김": "오늘의 기운은 네가 다루는 자리에 있어.",
  "나를 누름": "오늘은 밖의 힘이 너보다 센 자리야.",
  "같은 편": "오늘의 기운은 너와 같은 결이야.",
};

const RELATION_TEXT: Record<FlagResult["relation"], { title: string; body: string }> = {
  생받음: {
    title: "오늘은 받는 날입니다",
    body: "오늘의 기운이 나를 밀어주는 자리에 섭니다. 도움을 청하거나 배우는 일이 평소보다 수월하게 풀립니다.",
  },
  생해줌: {
    title: "오늘은 내보내는 날입니다",
    body: "내 기운이 밖으로 나가는 자리입니다. 만들고 표현하는 일에 힘이 실리는 대신, 다 쏟고 나면 비는 것도 빠릅니다.",
  },
  "내가 이김": {
    title: "오늘은 잡을 수 있는 날입니다",
    body: "내가 다루는 쪽에 오늘의 기운이 놓입니다. 미뤄둔 것을 손에 쥐고 정리하기에 어울립니다.",
  },
  "나를 누름": {
    title: "오늘은 눌리는 날입니다",
    body: "밖에서 오는 힘이 나보다 센 자리입니다. 맞서기보다 맡은 것의 경계를 분명히 해두는 편이 덜 지칩니다.",
  },
  "같은 편": {
    title: "오늘은 나란한 날입니다",
    body: "오늘의 기운이 나와 같은 결입니다. 힘이 붙는 만큼 나눌 일도 생기니, 몫을 미리 정해두면 편합니다.",
  },
};

function relationOf(mine: Ohaeng, today: Ohaeng): FlagResult["relation"] {
  if (mine === today) return "같은 편";
  if (GENERATES[today] === mine) return "생받음";
  if (GENERATES[mine] === today) return "생해줌";
  if (CONTROLS[mine] === today) return "내가 이김";
  return "나를 누름";
}

/**
 * 깃발을 뒤집으면 나오는 것.
 *
 * 어느 깃발을 골랐는지는 결과에 들어가지 않는다 — 들어가면 그 순간 무작위가
 * 된다. 고르는 행위는 사용자의 것이고, 답은 오늘의 것이다.
 */
export function flipFlag(myElement: Ohaeng, todayElement: Ohaeng): FlagResult {
  const relation = relationOf(myElement, todayElement);
  return {
    relation,
    todayElement,
    myElement,
    premise: RELATION_PREMISE[relation],
    ...RELATION_TEXT[relation],
  };
}

/** 오행 원형 그래프가 쓴다 — 목→화→토→금→수 상생 순서 */
export const CYCLE: Ohaeng[] = ["목", "화", "토", "금", "수"];

export { GENERATES, CONTROLS, RELATION_TEXT };

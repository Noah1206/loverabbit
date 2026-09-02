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
  신강: "나를 밀어주는 힘이 많은 편입니다. 벌이는 쪽이 수월하고, 멈추는 쪽이 어렵습니다.",
  중화: "밀어주는 힘과 덜어내는 힘이 비슷합니다. 어느 한쪽으로 크게 기울지 않습니다.",
  신약: "나를 덜어내는 쪽이 많은 편입니다. 살피는 쪽이 수월하고, 밀어붙이는 쪽이 어렵습니다.",
};

/**
 * 강약에서 나오는 행동강령.
 *
 * 신강·신약은 좋고 나쁨이 아니다 — 어느 쪽이 수월하고 어느 쪽이 품이 드는지의
 * 이야기다. 그래서 "고쳐라"가 아니라 "이건 남보다 힘드니 장치를 두라"로 쓴다.
 */
const STRENGTH_GUIDELINE: Record<"신강" | "중화" | "신약", Guideline> = {
  신강: {
    title: "멈추는 일에 장치를 두세요",
    body: "시작하고 밀어붙이는 것은 남보다 수월합니다. 대신 그만두는 판단이 늦어지기 쉬우니, 일을 벌일 때 끝내는 조건을 함께 적어두면 흐름을 낭비하지 않습니다.",
    basis: "강약",
  },
  중화: {
    title: "치우친 쪽을 그때그때 봅니다",
    body: "한쪽으로 크게 기울지 않아 상황을 따라가기 쉽습니다. 대신 기준이 흐려지기도 하니, 결정 앞에서 무엇을 먼저 볼지 한 가지만 정해두면 흔들림이 줄어듭니다.",
    basis: "강약",
  },
  신약: {
    title: "한 번에 하나만 잡으세요",
    body: "살피고 맞추는 것은 남보다 수월합니다. 대신 여러 개를 동시에 안으면 빨리 지치니, 벌여둔 것을 줄이는 쪽이 새로 시작하는 것보다 이득이 큽니다.",
    basis: "강약",
  },
};

// ── 오행 ───────────────────────────────────────────────────

/** 어느 오행이 많을 때의 지침 */
const EXCESS_GUIDELINE: Record<Ohaeng, Guideline> = {
  목: {
    title: "벌인 것을 세어보세요",
    body: "뻗어나가는 힘이 강해 계획이 쉽게 늘어납니다. 새로 시작하기 전에 지금 열려 있는 것을 세어보면, 힘이 흩어지지 않습니다.",
    basis: "오행 목",
  },
  화: {
    title: "말하기 전에 한 박자 둡니다",
    body: "드러내는 힘이 강해 반응이 빠릅니다. 그 빠름이 강점이지만, 중요한 자리에서는 한 박자 늦추는 것만으로 다르게 닿습니다.",
    basis: "오행 화",
  },
  토: {
    title: "쥐고 있는 것을 한 번 놓아봅니다",
    body: "버티는 힘이 강해 웬만해선 흔들리지 않습니다. 다만 안 맞는 것도 오래 버티기 쉬우니, 붙잡고 있는 것 하나를 의심해볼 만합니다.",
    basis: "오행 토",
  },
  금: {
    title: "덜 다듬고 내보내세요",
    body: "정리하는 힘이 강해 기준이 분명합니다. 그 기준이 자기 결과물에 향하면 끝없이 고치게 되니, 완성 전에 한 번 보여주는 쪽이 빠릅니다.",
    basis: "오행 금",
  },
  수: {
    title: "생각을 밖으로 꺼내세요",
    body: "스며들어 헤아리는 힘이 강해 안에서 오래 굴립니다. 머릿속에 둔 채로는 정리가 안 되니, 적거나 말하면 그 자리에서 가벼워집니다.",
    basis: "오행 수",
  },
};

/** 어느 오행이 없을 때의 지침 — 부족이 아니라 "손이 덜 가는 자리"로 쓴다 */
const ABSENT_GUIDELINE: Record<Ohaeng, Guideline> = {
  목: {
    title: "새로 시작하는 일에는 마중물이 필요합니다",
    body: "먼저 뻗어나가는 쪽이 자연스럽지는 않습니다. 시작을 의지에 맡기기보다, 시간과 자리를 먼저 정해두면 훨씬 수월해집니다.",
    basis: "오행 목 없음",
  },
  화: {
    title: "표현은 미루면 사라집니다",
    body: "드러내는 쪽이 자연스럽지는 않아, 마음이 있어도 전달이 늦습니다. 떠올랐을 때 바로 한 줄 보내는 습관이 관계에서 크게 갈립니다.",
    basis: "오행 화 없음",
  },
  토: {
    title: "돌아올 자리를 만들어두세요",
    body: "버티는 쪽이 자연스럽지는 않아 흔들릴 때 기댈 데가 필요합니다. 사람이든 습관이든 돌아올 자리를 하나 정해두면 회복이 빠릅니다.",
    basis: "오행 토 없음",
  },
  금: {
    title: "끝맺는 규칙을 밖에 두세요",
    body: "잘라내고 정리하는 쪽이 자연스럽지는 않습니다. 마감과 기준을 스스로의 판단이 아니라 달력이나 약속에 맡기면 덜 미룹니다.",
    basis: "오행 금 없음",
  },
  수: {
    title: "결정 전에 하루를 둡니다",
    body: "속으로 오래 헤아리는 쪽이 자연스럽지는 않아, 판단이 빠른 대신 되돌아보는 일이 적습니다. 큰 결정에는 하루를 얹으면 놓친 것이 보입니다.",
    basis: "오행 수 없음",
  },
};

// ── 십성 ───────────────────────────────────────────────────

/** 두드러진 십성에서 나오는 지침 — 흐름(FLOW)이 아니라 타고난 결이다 */
const TENGOD_GUIDELINE: Record<string, Guideline> = {
  비견: {
    title: "혼자 하는 편이 빠르지만, 그래서 늦어집니다",
    body: "제 힘으로 끌고 가는 결이라 남에게 맡기는 것이 어색합니다. 맡길 수 있는 것 하나를 정해 넘겨보면 전체가 빨라집니다.",
    basis: "십성 비견",
  },
  겁재: {
    title: "몫은 미리 말해두세요",
    body: "사람과 힘을 나누는 자리가 잦습니다. 나중에 갈리는 일이 생기기 쉬우니, 시작할 때 각자의 몫을 말로 못박아두는 것이 편합니다.",
    basis: "십성 겁재",
  },
  식신: {
    title: "꾸준함이 무기입니다",
    body: "내보내는 결이 순해서 오래 하는 일에 강합니다. 성과가 늦게 보여도 중간에 갈아타지 않는 편이 결국 더 멀리 갑니다.",
    basis: "십성 식신",
  },
  상관: {
    title: "말이 세게 나가는 자리를 압니다",
    body: "표현이 날카롭고 빠릅니다. 그게 강점인 자리와 상처가 되는 자리가 갈리니, 상대가 누구인지에 따라 세기를 정하면 됩니다.",
    basis: "십성 상관",
  },
  편재: {
    title: "기회는 넓게, 손은 좁게",
    body: "여러 갈래를 동시에 보는 결입니다. 보는 것은 넓혀도 실제로 손을 대는 것은 하나로 줄이면 흩어지지 않습니다.",
    basis: "십성 편재",
  },
  정재: {
    title: "쌓이는 것을 눈에 보이게 두세요",
    body: "차곡차곡 모으는 결입니다. 진행이 눈에 안 보이면 힘이 빠지니, 숫자든 기록이든 쌓이는 것을 보이는 자리에 두면 오래 갑니다.",
    basis: "십성 정재",
  },
  편관: {
    title: "압박이 있어야 움직입니다",
    body: "긴장이 걸릴 때 힘이 나는 결입니다. 마감이 없으면 미루기 쉬우니, 스스로 만든 마감보다 남과 약속한 마감이 잘 듣습니다.",
    basis: "십성 편관",
  },
  정관: {
    title: "규칙이 있으면 편합니다",
    body: "정해진 틀 안에서 안정적으로 움직이는 결입니다. 틀이 없는 일에서는 먼저 규칙을 만들고 시작하는 편이 낫습니다.",
    basis: "십성 정관",
  },
  편인: {
    title: "남과 다른 길로 이해합니다",
    body: "받아들이는 방식이 독특해 표준적인 설명이 잘 안 맞습니다. 자기 방식으로 다시 정리하는 시간을 아까워하지 않는 편이 좋습니다.",
    basis: "십성 편인",
  },
  정인: {
    title: "채우고 나서 움직입니다",
    body: "준비가 되어야 나서는 결입니다. 완벽히 채우려다 시기를 놓치기도 하니, 70%에서 한 번 내보내보는 연습이 도움이 됩니다.",
    basis: "십성 정인",
  },
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
  /** 뒤집기 전 깃대에 적힌 글자 */
  face: string;
}

/** 다섯 깃발은 늘 같은 자리에 선다 — 매번 섞으면 고르는 행위가 의미를 잃는다 */
export const FLAGS: DailyFlag[] = ELEMENTS.map((ohaeng) => ({
  ohaeng,
  className: ELEMENT_CLASS[ohaeng],
  face: ohaeng,
}));

export interface FlagResult {
  /** 오늘 내 일간이 받는 오행 관계 */
  relation: "생받음" | "생해줌" | "내가 이김" | "나를 누름" | "같은 편";
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
  return { relation, todayElement, myElement, ...RELATION_TEXT[relation] };
}

/** 오행 원형 그래프가 쓴다 — 목→화→토→금→수 상생 순서 */
export const CYCLE: Ohaeng[] = ["목", "화", "토", "금", "수"];

export { GENERATES, CONTROLS, RELATION_TEXT };

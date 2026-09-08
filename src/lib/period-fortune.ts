// 주간·월간 운세 — 이번 주와 이번 달의 결.
//
// 왜 만드는가.
//
// 반복해서 볼 수 있는 것이 오늘의 운세 하나뿐이었다. 유료 20종은 명식이
// 안 바뀌니 한 번 사면 다시 살 이유가 없고, 오늘의 운세는 40칸이라 40일이면
// 한 바퀴 돈다. 다시 올 이유가 사실상 없다는 뜻이다.
//
// 주간·월간은 그 구멍을 가장 싸게 메운다. 계산이 이미 있기 때문이다 —
// 세운·월운의 간지와 십성은 saju-score.ts 의 luckContext 가 벌써 내주고
// 있었고(yearly/monthly), 여기서 새로 재는 것은 **주운**뿐이다.
//
// 왜 모델을 부르지 않는가. daily-action.ts 와 같은 이유다: 축이 둘뿐이라
// (흐름 5 × 영역 8) 표로 끝난다. 표로 끝나는 것을 모델에 맡기면 같은 주에
// 같은 사람에게 다른 문장이 나가고, 캐시와 폴백과 가드가 전부 필요해진다.
// 이 파일의 문자열은 사람이 검수한 것으로 본다 — 여기를 고치는 것이 검수다.
//
// 오늘의 운세와 무엇이 다른가. 오늘은 **행동 하나**를 준다("~하자, 15분").
// 주와 달은 그 단위로 끝낼 수 있는 일이 아니라서, 대신 **흐름과 시기**를
// 말한다: 무엇이 유리한 국면인지, 무엇을 미루는 편이 나은지.

import { CHEONGAN, computeSaju, dayPillarOf, pillarLabel, type Pillar } from "@/lib/saju";
import { stemElement, tenGodOf } from "@/lib/saju-facts";
import {
  DOMAIN_LABEL,
  DOMAINS,
  FLOW_OF,
  type Flow,
  type FortuneDomain,
  type TenGod,
} from "@/lib/daily-action";

export type Period = "week" | "month";

/* 흐름 축(비겁·식상·재성·관성·인성)과 그 매핑은 daily-action.ts 의 것을
   그대로 쓴다 — 두 화면이 같은 축으로 말해야 "오늘은 이런데 이번 주는
   이렇다" 가 이어진다. 여기서 다시 정의하면 언젠가 둘이 갈라진다. */
export type { Flow };

/** 천간 열 개는 갑(0)부터 번갈아 양·음이다 */
function isYang(ganIdx: number): boolean {
  return ganIdx % 2 === 0;
}

export interface PeriodCopy {
  /** 이 기간의 결 한 줄 */
  headline: string;
  /** 무엇이 유리한 국면인가 */
  flowNote: string;
  /** 이 기간에 두면 좋은 것 */
  focus: string;
  /** 미루는 편이 나은 것 */
  hold: string;
}

/**
 * 40칸 표 — 흐름 5 × 영역 8. 주와 달이 같은 표를 쓰고, 문장은 기간 이름만
 * 갈아 끼운다({기간}) — 같은 흐름이면 주에 유리한 것과 달에 유리한 것이
 * 다르지 않다. 다른 것은 호흡의 길이뿐이라 그건 화면이 말한다.
 *
 * 지키는 선은 daily-action.ts 와 같다: 단정하지 않고("반드시", "확정"),
 * 재물은 벌이는 쪽을 권하지 않고 점검까지, 건강은 생활 습관까지만 —
 * 진단도 처방도 아니다.
 */
const TABLE: Record<Flow, Record<FortuneDomain, PeriodCopy>> = {
  비겁: {
    love: {
      headline: "둘 사이에 사람이 끼기 쉬운 {기간}",
      flowNote: "주변의 말이 많아지는 결이에요. 판단의 출처를 좁히면 흔들림이 줄어요.",
      focus: "상대에게 직접 확인하는 대화를 이 {기간} 안에 한 번 두세요.",
      hold: "남의 말로 상대에 대한 결론을 내리는 일은 미루는 편이 나아요.",
    },
    money: {
      headline: "몫이 섞이기 쉬운 {기간}",
      flowNote: "남과 얽힌 돈의 경계가 흐려지는 결이에요.",
      focus: "함께 나눠 낸 돈의 금액과 날짜를 적어 두기 좋은 {기간}이에요.",
      hold: "금액을 정하지 않은 채 돈이 오가게 두는 일은 미뤄 두세요.",
    },
    study: {
      headline: "혼자 끌지 않아도 되는 {기간}",
      flowNote: "묻는 쪽이 더 멀리 가는 결이에요.",
      focus: "혼자 막혀 있던 것을 꺼내 물어보기 좋은 {기간}이에요.",
      hold: "남의 진도에 맞춰 계획을 갈아엎는 일은 미루세요.",
    },
    career: {
      headline: "일의 지분이 흐려지기 쉬운 {기간}",
      flowNote: "함께 하는 일에서 내 몫의 경계가 잘 안 보이는 결이에요.",
      focus: "내가 맡은 범위를 한 문장으로 적어 확인받기 좋은 {기간}이에요.",
      hold: "주인 없는 일을 말없이 떠맡는 것은 미뤄 두세요.",
    },
    business: {
      headline: "동업의 조건을 다시 보는 {기간}",
      flowNote: "함께 하는 쪽의 경계가 시험받는 결이에요.",
      focus: "역할과 몫을 글로 남겨 두기 좋은 {기간}이에요.",
      hold: "말로만 정한 조건 위에 새 일을 얹는 것은 미루세요.",
    },
    relationship: {
      headline: "무리 안에서 내 자리를 보는 {기간}",
      flowNote: "비슷한 사람이 늘고, 그만큼 비교도 늘어나는 결이에요.",
      focus: "가까운 사람 한 명과 따로 이야기하기 좋은 {기간}이에요.",
      hold: "여럿 앞에서 서운함을 꺼내는 일은 미루는 편이 나아요.",
    },
    health: {
      headline: "무리하기 쉬운 {기간}",
      flowNote: "남을 따라 속도를 올리기 쉬운 결이에요.",
      focus: "잠드는 시각을 일정하게 두기 좋은 {기간}이에요.",
      hold: "남의 강도에 맞춰 운동량을 갑자기 늘리는 것은 미루세요.",
    },
    growth: {
      headline: "내 기준을 세우는 {기간}",
      flowNote: "남의 속도가 잘 보이는 만큼 내 기준이 흔들리는 결이에요.",
      focus: "내가 올해 지키기로 한 것 하나를 다시 적어 보세요.",
      hold: "남의 방식으로 내 계획을 통째로 바꾸는 일은 미루세요.",
    },
  },
  식상: {
    love: {
      headline: "말이 잘 닿는 {기간}",
      flowNote: "표현하는 쪽으로 기운이 도는 결이에요.",
      focus: "담아 두었던 한마디를 꺼내기 좋은 {기간}이에요.",
      hold: "말이 앞서 상대의 대답을 기다리지 않는 것은 조심하세요.",
    },
    money: {
      headline: "쓰는 쪽으로 손이 가는 {기간}",
      flowNote: "표현과 소비가 같이 늘어나는 결이에요.",
      focus: "이 {기간}의 지출을 한 번 훑어보기 좋아요.",
      hold: "기분으로 정하는 큰 지출은 미뤄 두세요.",
    },
    study: {
      headline: "정리해서 내놓기 좋은 {기간}",
      flowNote: "머릿속의 것을 밖으로 꺼낼 때 정리되는 결이에요.",
      focus: "배운 것을 남에게 설명해 보기 좋은 {기간}이에요.",
      hold: "새 교재를 더 사들이는 일은 미루세요.",
    },
    career: {
      headline: "내 결과물이 보이는 {기간}",
      flowNote: "만든 것을 드러낼 때 평가가 붙는 결이에요.",
      focus: "해 둔 일을 정리해 보고하기 좋은 {기간}이에요.",
      hold: "아직 안 끝난 것을 완성된 것처럼 말하는 것은 조심하세요.",
    },
    business: {
      headline: "알리는 쪽이 유리한 {기간}",
      flowNote: "내놓는 만큼 반응이 오는 결이에요.",
      focus: "하고 있는 일을 한 문장으로 다듬어 두기 좋아요.",
      hold: "준비가 덜 된 것을 서둘러 여는 일은 미루세요.",
    },
    relationship: {
      headline: "사람이 모이는 {기간}",
      flowNote: "말이 오가며 관계가 넓어지는 결이에요.",
      focus: "오래 못 본 사람에게 먼저 연락하기 좋은 {기간}이에요.",
      hold: "그 자리에서 남의 이야기를 옮기는 일은 조심하세요.",
    },
    health: {
      headline: "기운을 쓰는 {기간}",
      flowNote: "밖으로 내는 쪽으로 도는 결이라 쉽게 지쳐요.",
      focus: "쉬는 시간을 미리 정해 두기 좋은 {기간}이에요.",
      hold: "피곤한 채로 약속을 계속 얹는 것은 미루세요.",
    },
    growth: {
      headline: "만들어 보기 좋은 {기간}",
      flowNote: "머리로만 두던 것을 손에 옮길 때 잘 풀리는 결이에요.",
      focus: "생각만 하던 것을 아주 작게라도 시작해 보세요.",
      hold: "완성도부터 따지느라 시작을 미루는 일은 조심하세요.",
    },
  },
  재성: {
    love: {
      headline: "재고 따지게 되는 {기간}",
      flowNote: "감정보다 조건이 먼저 보이는 결이에요.",
      focus: "상대에게 실제로 해 준 것과 받은 것을 헤아려 보세요.",
      hold: "손익으로 관계를 결론짓는 일은 미루는 편이 나아요.",
    },
    money: {
      headline: "늘리기보다 세어 보는 {기간}",
      flowNote: "돈의 흐름이 눈에 잘 들어오는 결이에요.",
      focus: "고정 지출을 한 번 훑어보기 좋은 {기간}이에요.",
      hold: "확인이 덜 된 곳에 돈을 넣는 일은 미뤄 두세요.",
    },
    study: {
      headline: "양을 재는 {기간}",
      flowNote: "얼마나 했는지가 드러나는 결이에요.",
      focus: "남은 분량을 날짜로 나눠 두기 좋은 {기간}이에요.",
      hold: "계획 없이 시간만 늘리는 방식은 미루세요.",
    },
    career: {
      headline: "성과가 숫자로 보이는 {기간}",
      flowNote: "한 일이 값으로 환산되는 결이에요.",
      focus: "내가 만든 결과를 숫자로 적어 두기 좋아요.",
      hold: "값을 정하지 않은 채 일을 더 맡는 것은 미루세요.",
    },
    business: {
      headline: "셈을 맞추는 {기간}",
      flowNote: "들어오고 나가는 것이 또렷해지는 결이에요.",
      focus: "이 {기간}의 수입과 비용을 한 장에 정리해 보세요.",
      hold: "규모를 키우는 결정은 미뤄 두는 편이 나아요.",
    },
    relationship: {
      headline: "주고받음이 보이는 {기간}",
      flowNote: "관계의 무게가 한쪽으로 기울면 눈에 띄는 결이에요.",
      focus: "받기만 한 쪽에 작게라도 갚아 두기 좋은 {기간}이에요.",
      hold: "셈을 그대로 입 밖에 내는 일은 조심하세요.",
    },
    health: {
      headline: "몸을 재어 보는 {기간}",
      flowNote: "쌓인 것이 수치로 드러나기 쉬운 결이에요.",
      focus: "식사 시간을 일정하게 두기 좋은 {기간}이에요.",
      hold: "단기간에 몸을 크게 바꾸려는 시도는 미루세요.",
    },
    growth: {
      headline: "손에 잡히는 것을 만드는 {기간}",
      flowNote: "결과로 남는 쪽에 기운이 도는 결이에요.",
      focus: "지금 하는 일에서 눈에 보이는 결과 하나를 정해 보세요.",
      hold: "여러 가지를 동시에 벌이는 일은 미뤄 두세요.",
    },
  },
  관성: {
    love: {
      headline: "관계의 자리를 정하는 {기간}",
      flowNote: "애매한 것이 애매한 채로 남기 어려운 결이에요.",
      focus: "서로의 자리를 한 번 확인해 보기 좋은 {기간}이에요.",
      hold: "정해지지 않은 것을 정해진 것처럼 말하는 일은 조심하세요.",
    },
    money: {
      headline: "규칙을 세우는 {기간}",
      flowNote: "돈에 틀이 필요해지는 결이에요.",
      focus: "이 {기간} 동안 쓸 한도를 하나 정해 보세요.",
      hold: "한도를 정하기 전에 큰 결제를 하는 일은 미루세요.",
    },
    study: {
      headline: "하나만 정하는 {기간}",
      flowNote: "여러 갈래를 동시에 쥐면 다 놓치는 결이에요.",
      focus: "이 {기간}에 끝낼 것 하나만 남겨 두세요.",
      hold: "새 과목이나 새 방식을 더 얹는 일은 미루세요.",
    },
    career: {
      headline: "책임이 또렷해지는 {기간}",
      flowNote: "맡은 자리가 분명해지는 결이에요.",
      focus: "내가 끝까지 지는 일 하나를 정해 두기 좋아요.",
      hold: "결정권 없는 일에 이름을 얹는 것은 미루세요.",
    },
    business: {
      headline: "틀을 잡는 {기간}",
      flowNote: "규칙 없이 굴러가던 것이 걸리는 결이에요.",
      focus: "반복되는 일 하나를 절차로 적어 두기 좋아요.",
      hold: "틀이 없는 채로 사람을 늘리는 일은 미루세요.",
    },
    relationship: {
      headline: "선이 필요한 {기간}",
      flowNote: "거리가 애매하면 부딪히는 결이에요.",
      focus: "지킬 선 하나를 스스로 정해 두기 좋은 {기간}이에요.",
      hold: "그 선을 상대에게 통보하듯 말하는 것은 조심하세요.",
    },
    health: {
      headline: "규칙이 몸을 지키는 {기간}",
      flowNote: "무너진 리듬이 곧장 드러나는 결이에요.",
      focus: "일어나는 시각을 하나로 두기 좋은 {기간}이에요.",
      hold: "밤을 새워 몰아서 하는 방식은 미뤄 두세요.",
    },
    growth: {
      headline: "지킬 것을 정하는 {기간}",
      flowNote: "느슨한 계획이 잘 안 굴러가는 결이에요.",
      focus: "이 {기간} 동안 지킬 규칙 하나를 정해 보세요.",
      hold: "규칙을 여러 개 한꺼번에 세우는 일은 미루세요.",
    },
  },
  인성: {
    love: {
      headline: "받는 쪽으로 기우는 {기간}",
      flowNote: "기대고 싶어지는 결이에요.",
      focus: "고맙다는 말을 늦기 전에 전하기 좋은 {기간}이에요.",
      hold: "말하지 않은 기대를 상대가 알아주길 바라는 것은 조심하세요.",
    },
    money: {
      headline: "쓰기보다 채우는 {기간}",
      flowNote: "나가는 것보다 들이는 쪽이 맞는 결이에요.",
      focus: "당장 안 쓰는 돈을 따로 떼어 두기 좋아요.",
      hold: "빌려서 무언가를 시작하는 일은 미뤄 두세요.",
    },
    study: {
      headline: "쌓기 좋은 {기간}",
      flowNote: "들이는 것이 잘 남는 결이에요.",
      focus: "기초로 돌아가 다시 보기 좋은 {기간}이에요.",
      hold: "진도만 앞세워 넘어가는 방식은 미루세요.",
    },
    career: {
      headline: "배우는 자리에 서는 {기간}",
      flowNote: "나서기보다 익히는 쪽이 남는 결이에요.",
      focus: "잘하는 사람의 방식을 하나 옮겨 적어 보세요.",
      hold: "준비가 덜 된 일을 먼저 맡겠다고 나서는 것은 미루세요.",
    },
    business: {
      headline: "안을 다지는 {기간}",
      flowNote: "밖으로 벌이기보다 안이 채워지는 결이에요.",
      focus: "이미 있는 것을 다듬어 두기 좋은 {기간}이에요.",
      hold: "새 판을 크게 벌이는 일은 미뤄 두세요.",
    },
    relationship: {
      headline: "도움이 오는 {기간}",
      flowNote: "받는 쪽으로 기운이 도는 결이에요.",
      focus: "먼저 손 내밀어 준 사람에게 답을 두기 좋아요.",
      hold: "받기만 하고 그대로 두는 일은 미루지 마세요.",
    },
    health: {
      headline: "쉬어야 채워지는 {기간}",
      flowNote: "몸이 회복을 먼저 부르는 결이에요.",
      focus: "잠을 늘리기 좋은 {기간}이에요.",
      hold: "쉬는 시간을 다른 일로 채우는 것은 미루세요.",
    },
    growth: {
      headline: "안으로 채우는 {기간}",
      flowNote: "밖으로 보이는 것보다 안이 자라는 결이에요.",
      focus: "읽고 싶던 것 하나를 붙잡기 좋은 {기간}이에요.",
      hold: "성과가 안 보인다고 방향을 바꾸는 일은 미루세요.",
    },
  },
};

export interface PeriodInput {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  domain: FortuneDomain;
  period: Period;
  /** 기준 시각 (테스트용). 없으면 지금 */
  nowMs?: number;
}

export interface PeriodFortune {
  period: Period;
  /** "이번 주" | "이번 달" */
  periodLabel: string;
  /** 주는 시작~끝 날짜, 달은 그 달 */
  rangeLabel: string;
  domain: FortuneDomain;
  domainLabel: string;
  flow: Flow;
  tenGod: TenGod;
  /** 무엇을 기준으로 잰 것인가 — 화면이 근거로 적는다 */
  basis: { dayMaster: string; pillar: string; pillarLabel: string };
  copy: PeriodCopy;
}

/** 그 주의 월요일 0시 (한국 기준은 화면이 맞춘다 — 여기는 넘어온 시각을 그대로 쓴다) */
function weekStart(ms: number): Date {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  // getDay: 0=일. 월요일 시작으로 맞춘다 — 일요일이면 6일 전이 그 주의 월요일이다.
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d;
}

function fmt(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 이번 주 / 이번 달의 결.
 *
 * 주운은 그 주 **월요일의 일진**으로 잰다. 주를 대표하는 간지가 명리에 따로
 * 없어서, 주의 첫날을 그 주의 얼굴로 삼는다 — 이 선택을 화면이 근거로
 * 밝힌다(basis). 월운은 계산된 월주를 그대로 쓴다.
 */
export function buildPeriodFortune(input: PeriodInput): PeriodFortune {
  const chart = computeSaju({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: 0,
  });
  const dayMaster = CHEONGAN[chart.day.ganIdx];

  const now = input.nowMs ?? Date.now();
  let pillar: Pillar;
  let rangeLabel: string;

  if (input.period === "week") {
    const start = weekStart(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    pillar = dayPillarOf(start.getTime());
    rangeLabel = `${fmt(start)} ~ ${fmt(end)}`;
  } else {
    const d = new Date(now);
    // 그 달의 사주 월주 — computeSaju 가 절기까지 맞춰 준다
    const monthChart = computeSaju({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: 12,
      minute: 0,
    });
    pillar = monthChart.month;
    rangeLabel = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }

  const tenGod = tenGodOf(
    stemElement(chart.day.ganIdx),
    isYang(chart.day.ganIdx),
    stemElement(pillar.ganIdx),
    isYang(pillar.ganIdx)
  ) as TenGod;
  const flow = FLOW_OF[tenGod];
  const periodLabel = input.period === "week" ? "이번 주" : "이번 달";

  const raw = TABLE[flow][input.domain];
  const swap = (t: string) => t.replace(/\{기간\}/g, input.period === "week" ? "주" : "달");

  return {
    period: input.period,
    periodLabel,
    rangeLabel,
    domain: input.domain,
    domainLabel: DOMAIN_LABEL[input.domain],
    flow,
    tenGod,
    basis: {
      dayMaster: `${dayMaster}${stemElement(chart.day.ganIdx)}`,
      pillar: pillarLabel(pillar),
      pillarLabel: input.period === "week" ? "그 주 첫날의 일진" : "이번 달의 월주",
    },
    copy: {
      headline: swap(raw.headline),
      flowNote: swap(raw.flowNote),
      focus: swap(raw.focus),
      hold: swap(raw.hold),
    },
  };
}

/** 한 기간의 여덟 영역 전부 */
export function buildAllDomains(input: Omit<PeriodInput, "domain">): PeriodFortune[] {
  return DOMAINS.map((domain) => buildPeriodFortune({ ...input, domain }));
}

/** 표 전체 — 검사와 운영 점검용 */
export const PERIOD_TABLE = TABLE;

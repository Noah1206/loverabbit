// 마지막 장의 부적.
//
// 장마다 들어가는 장면 그림과는 다른 물건이다. 그쪽은 "감정이 머무는 자리"를 그리고
// 부적·점집 소품을 일부러 뺐다 — 사주 풀이를 무속 연출로 만들지 않으려고.
// 이건 반대로, 다 읽고 나서 **가져가는 것**이다. 화면 밖으로 나가 앨범에 남는다.
//
// 그래서 두 가지가 다르다.
//   · 지시문을 모델에게 맡기지 않는다. 부적의 모양은 정해져 있고, 사람마다 달라지는 건
//     일간의 오행 하나뿐이다. 매번 다른 그림이 나오면 그건 부적이 아니라 그냥 그림이다.
//   · 세로로 길게 뽑는다. 저장해서 볼 물건이라 1:1 정사각형은 어울리지 않는다.
//
// 글자는 넣지 않는다. 그림 모델이 쓰는 한자는 대부분 실제로 없는 글자이고,
// 부적에 뜻 모를 글자가 박히면 그게 제일 우스워진다. 문양으로만 간다.

import { CHEONGAN, CHEONGAN_OHAENG, type Ohaeng } from "@/lib/saju";

/** 오행마다 다른 색과 결. 이것만 사람마다 바뀐다. */
const BY_ELEMENT: Record<Ohaeng, { color: string; motif: string }> = {
  목: { color: "짙은 청록과 먹빛", motif: "곧게 뻗은 줄기와 어린 잎맥" },
  화: { color: "주홍과 진사(辰砂) 붉은빛", motif: "타오르는 불꽃과 흩어지는 불티" },
  토: { color: "황토빛과 옅은 금색", motif: "층층이 쌓인 땅의 결과 둥근 돌" },
  금: { color: "흰빛과 서늘한 은색", motif: "날이 선 금속의 결과 성긴 서리" },
  수: { color: "쪽빛과 검푸른 남색", motif: "굽이치는 물결과 흩어지는 물방울" },
};

/** 한글 천간 한 글자에서 오행을 찾는다. 모르면 토 — 가운데를 기본으로 둔다. */
export function elementOfStem(stem: string): Ohaeng {
  const at = (CHEONGAN as readonly string[]).indexOf(stem);
  return at >= 0 ? CHEONGAN_OHAENG[at] : "토";
}

/**
 * "임신 계축 을사 계미" 에서 일간 한 글자를 꺼낸다.
 * 세 번째가 일주이고 그 첫 글자가 일간이다. 모양이 다르면 null.
 */
export function dayStemOf(chart: string): string | null {
  const pillars = chart.trim().split(/\s+/);
  const day = pillars[2];
  return day && day.length >= 1 && (CHEONGAN as readonly string[]).includes(day[0]) ? day[0] : null;
}

export interface TalismanPlan {
  prompt: string;
  alt: string;
  element: Ohaeng;
}

/**
 * 부적 한 장의 지시문. 모델이 쓰지 않고 여기서 조립한다 —
 * 같은 오행이면 언제나 같은 결이 나와야 부적 구실을 한다.
 */
export function planTalisman(chart: string, label: string): TalismanPlan {
  const stem = dayStemOf(chart);
  const element = stem ? elementOfStem(stem) : "토";
  const { color, motif } = BY_ELEMENT[element];

  const prompt = [
    `한국 전통 부적 한 장을 세로로 그린다. 오래된 한지의 결이 살아 있고 가장자리는 조금 닳았다.`,
    `${color}으로 그린 대칭 문양이 가운데를 세로로 가로지르고, ${motif}이 그 안에 녹아 있다.`,
    `문양은 손으로 그은 붓질처럼 굵기가 일정하지 않고, 위아래로 여백을 넉넉히 둔다.`,
    // 이 두 줄이 핵심이다. 글자를 허용하면 있지도 않은 한자가 박힌다.
    `**글자, 한자, 숫자, 기호를 절대 넣지 않는다.** 오직 문양뿐이다.`,
    `사람, 얼굴, 동물, 부적 이외의 물건을 넣지 않는다.`,
    `배경은 어둡고 차분하며, 부적만 은은하게 떠오르듯 빛난다.`,
    `매끄러운 디지털 채색. 사진이 아니다.`,
  ].join(" ");

  return { prompt, alt: `${label} 부적 — ${element}의 기운을 담은 문양`, element };
}

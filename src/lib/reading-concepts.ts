// 분야별 리딩 컨셉 — 화면 구조는 모든 리딩이 똑같고, 장 제목만 분야마다 다르다.
//
// 여기서 정하는 것: 인장 두 글자, 표지 한 줄, 장 제목.
// 여기서 정하지 않는 것: 레이아웃, 폰트 크기, 색, 잠금 규칙 — 그건 뷰어가 갖는다.
//
// 화자(캐릭터)와 신당은 걷어냈다. 이건 무당이 봐주는 점사가 아니라 사주 풀이이고,
// 캐릭터 그림과 말풍선이 본문 앞을 막으면 긴 글의 가독성만 깎였다.
// 분야마다 색을 갈아입히던 것도 뺐다 — 색이 분야를 알려주지는 않고 글만 어지럽혔다.

export interface ReadingConcept {
  /** 인장에 새기는 두 글자 — 표지와 상단 바에 찍히는 표식 */
  seal: string;
  /** 표지 상단에 얹는 한 줄 */
  cover: string;
  /**
   * 장 제목을 손으로 정하고 싶을 때만 채운다. **비워 두는 것이 기본이다.**
   *
   * 비어 있으면 그 장 첫 절의 제목이 곧 장 제목이 된다(reading-chapters.ts).
   * 목차를 잘게 묶으면서 장 수가 두 배가 됐는데, 제목을 두 곳에 적어 두면
   * 한쪽만 고쳐져 어긋난다. 목차 하나만 진실로 둔다.
   */
  chapters: string[];
  /** 마지막 장(에필로그) 제목 */
  epilogue: string;
}

const FALLBACK: ReadingConcept = {
  seal: "戀運",
  cover: "네 명식에 적힌 것만 읽는다",
  chapters: [],
  epilogue: "마지막 정리",
};

export const READING_CONCEPTS: Record<string, ReadingConcept> = {
  // 속궁합 — 두 사람의 온도. 화린도령의 불꽃.
  sokgunghap: {
    seal: "相合",
    cover: "말보다 먼저 닿는 두 사람의 온도",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 재회 — 남은 감정. 연화아씨의 온기.
  jaehoe: {
    seal: "再會",
    cover: "끝난 대화 뒤에 남은 잔향",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 연애 기질 — 나의 얼굴. 매화아씨.
  bamgijil: {
    seal: "氣質",
    cover: "연애할 때만 드러나는 네 얼굴",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 바람기 — 상대 검증. 청사도령의 서늘함.
  baramgi: {
    seal: "風氣",
    cover: "달콤한 말 뒤에 남는 한 가지",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 결혼 — 평생의 판단. 금야도령의 금빛 무게.
  gyeolhon: {
    seal: "婚緣",
    cover: "연애 궁합과 결혼 궁합은 다른 자리",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 권태기 — 식은 온도. 묵연도령의 먹빛.
  gwontaegi: {
    seal: "倦怠",
    cover: "지워도 남는 답답함의 정체",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 환승 — 두 갈래 길. 비화신녀의 남빛.
  hwanseung: {
    seal: "換乘",
    cover: "두 갈래 길 앞에 선 밤",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 썸 — 속도 차이. 홍련신녀.
  sseom: {
    seal: "情跡",
    cover: "밀당인지 진심인지 가려주는 자리",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 짝사랑 — 혼자 앓는 마음. 자월신녀의 보랏빛.
  jjak: {
    seal: "片戀",
    cover: "혼자 삼킨 마음의 무게",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 비밀연애 — 숨긴 관계. 적야도령.
  bimil: {
    seal: "密戀",
    cover: "감춰야만 이어지는 관계의 온도",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 이별 부검 — 끝난 관계의 사인 규명. 묵연도령의 촛불 버전.
  ibyeol: {
    seal: "剖檢",
    cover: "끝난 관계를 열어보는 자리",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 도화살 — 타고난 이성운. 홍련신녀의 복숭아빛 버전.
  dohwasal: {
    seal: "桃花",
    cover: "끌어당기는 기운의 정체",
    chapters: [],
    epilogue: "마지막 정리",
  },

  // 올해의 연애운 — 세운 중심. 자월신녀의 별빛 버전.
  yeonae: {
    seal: "流年",
    cover: "올해 남은 달들을 세는 자리",
    chapters: [],
    epilogue: "마지막 정리",
  },
};

export function conceptFor(productId: string | undefined): ReadingConcept {
  return (productId && READING_CONCEPTS[productId]) || FALLBACK;
}

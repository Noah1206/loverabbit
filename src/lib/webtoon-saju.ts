// 웹툰 사주 — 순수 데이터와 계산만. 서버 검증은 /api/webtoon-readings, 화면은 /webtoon-saju.
//
// 그림은 love-rabbit 씬 일러스트(Moonlit Rabbit Oracle 30장)를 그대로 쓴다.
// 운세마다 겹치지 않는 감정 키를 배정해 재물·연애·이별 데이터가 섞이지 않는다.
//   재물: hesitation · wavering · resolve · thrill
//   연애: attraction · waiting
//   이별: crack · longing · separation · recovery
// 텍스트는 이미지에 굽지 않는다 — WebtoonTextOverlay 가 별도 DOM 레이어로 그린다.
// 그래서 카피·이름·화법을 바꿔도 이미지 재생성이 없다.
//
// 주인공은 리딩을 만든 사용자, 화자는 러브레빗 로고 토끼다.

export type FortuneType = "money" | "love" | "breakup";

export const FORTUNE_TYPES: readonly FortuneType[] = ["money", "love", "breakup"];

export function isFortuneType(v: unknown): v is FortuneType {
  return v === "money" || v === "love" || v === "breakup";
}

export const WEBTOON_FORTUNE_CONFIG: Record<
  FortuneType,
  { label: string; theme: string; unlockCost: number }
> = {
  money: {
    label: "재물운",
    theme: "기회 포착, 소비 습관, 실행과 축적, 현실적인 선택",
    unlockCost: 29,
  },
  love: {
    label: "연애운",
    theme: "호감 표현, 관계의 속도, 대화, 감정의 균형",
    unlockCost: 29,
  },
  breakup: {
    label: "이별운",
    theme: "거리 조절, 미련, 회복, 다시 나를 돌보는 선택",
    unlockCost: 29,
  },
};

/** 무료로 보여주는 앞 패널 수 */
export const FREE_PANEL_COUNT = 2;

/**
 * 원장 ref. (reason='reading', ref) unique 인덱스가 해금 상태의 정본이자
 * 멱등 키다 — 같은 ref 로 두 번 차감되지 않고, 별도 해금 테이블도 필요 없다.
 */
export function webtoonUnlockRef(readingId: string, fortuneType: FortuneType): string {
  return `webtoon:${readingId}:${fortuneType}`;
}

export interface TextOverlay {
  id: string;
  type: "speech" | "caption" | "title" | "label";
  text: string;
  /** % 좌표 — 390px 모바일에서도 위치가 유지된다 */
  x: number;
  y: number;
  width: number;
  align?: "left" | "center" | "right";
  tone?: "rabbit" | "subject" | "system";
  /**
   * 꼬리가 가리키는 쪽. 말풍선은 화자 위에 뜨고 꼬리가 화자를 향해 내려간다 —
   * 웹툰의 기본 문법이다. 없으면 꼬리 없는 사각 말풍선.
   */
  tail?: "bottom-left" | "bottom-right" | "bottom-center";
}

/**
 * 화자가 그림 어디에 서 있는가. 말풍선 좌표는 여기서 파생된다 —
 * 패널마다 좌표를 손으로 찍으면 그림이 바뀔 때마다 겹친다.
 *
 * 이미지 프롬프트가 이 자리를 못박고(왼쪽 아래에 토끼, 오른쪽에 인물),
 * 여기가 그 약속을 코드 쪽에서 받는다. 둘이 같은 규약을 보고 있어야
 * 말풍선이 화자 위에 앉고 얼굴을 가리지 않는다.
 */
export type SpeakerAnchor = "left-low" | "right-low" | "left-high" | "right-high";

/**
 * 화자 위치에서 말풍선 자리를 낸다.
 *
 * 규칙(레퍼런스 웹툰의 문법):
 *   · 말풍선은 화자의 머리 위 또는 대각 위에 뜬다
 *   · 화자의 몸·얼굴을 덮지 않는다
 *   · 꼬리는 화자 쪽을 향한다
 *   · 한 컷에 둘이면 위아래 계단식으로 앉는다 (index 로 내린다)
 */
export function bubbleAt(anchor: SpeakerAnchor, index = 0): Pick<TextOverlay, "x" | "y" | "width" | "align" | "tail"> {
  const step = index * 18; // 두 번째 말풍선은 아래로 한 칸
  switch (anchor) {
    case "left-low":
      return { x: 6, y: 9 + step, width: 56, align: "left", tail: "bottom-left" };
    case "right-low":
      return { x: 38, y: 9 + step, width: 56, align: "left", tail: "bottom-right" };
    case "left-high":
      // 화자가 위에 있으면 말풍선은 아래 빈 바닥으로 내려온다
      return { x: 6, y: 66 - step, width: 56, align: "left", tail: "bottom-left" };
    case "right-high":
      return { x: 38, y: 66 - step, width: 56, align: "left", tail: "bottom-right" };
  }
}

export interface WebtoonPanelData {
  id: string;
  imageUrl: string;
  alt: string;
  overlays: TextOverlay[];
  isPreview: boolean;
}

export interface WebtoonContent {
  panels: WebtoonPanelData[];
  coverImageUrl: string;
  previewText: string;
  previewPoints: string[];
  fullParagraphs: string[];
}

/**
 * 웹툰 전용 컷. 운세마다 표지 1장 + 패널 4장.
 *
 * 리딩 화면의 씬 일러스트(love-rabbit/scenes)를 빌려 쓰던 것을 갈아끼웠다.
 * 그쪽은 감정 결 하나를 담은 단일 그림이라 화자가 없다 — 웹툰은 토끼가 장면
 * 안에 있어야 말풍선의 꼬리가 가리킬 곳이 생긴다.
 *
 * 모든 컷이 같은 약속을 지킨다 (프롬프트에 못박았다):
 *   · 상단 34% 는 비어 있다 — 말풍선이 앉는 자리
 *   · 토끼는 아래 왼쪽 또는 아래 오른쪽 (bubbleAt 의 앵커와 짝)
 *   · 사람 얼굴은 보이지 않는다 (뒷모습·실루엣)
 *   · 글자가 그려져 있지 않다 — 문장은 전부 오버레이가 그린다
 */
const cut = (name: string) => `/assets/webtoon-saju/${name}.webp`;

/**
 * 이메일에서 화면용 별명. 생년월일·전화번호 같은 개인정보는 여기 절대 안 들어온다.
 */
export function nicknameFromEmail(email?: string | null): string {
  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  if (!local) return "여행자";
  return local.length > 12 ? local.slice(0, 12) : local;
}

/**
 * 운세별 패널·텍스트. v1 은 흐름 안내형 고정 카피다 — 점수·날짜·간지 같은
 * 명리 값을 지어내지 않는다. 명식 기반 문장은 reading 파이프라인과 붙일 때 온다.
 */
export function buildWebtoonContent(fortuneType: FortuneType, nickname: string): WebtoonContent {
  if (fortuneType === "money") {
    return {
      coverImageUrl: cut("money-cover"),
      previewText: `${nickname}, 이번 재물운은 큰 한 방보다 방향을 잡는 장이야. 새는 곳을 먼저 찾으면 흐름이 한 줄로 모여.`,
      previewPoints: [
        "기회는 속도보다 방향에서 시작돼요",
        "소비 습관의 결을 먼저 읽어요",
        "축적은 큰 결심이 아니라 반복에서 와요",
      ],
      fullParagraphs: [
        `${nickname}의 이번 흐름에서 먼저 볼 것은 들어오는 돈이 아니라 나가는 돈의 결이에요. 어디서 새는지 아는 순간, 같은 수입으로도 손에 남는 양이 달라져요.`,
        "기회가 왔을 때의 판단 기준을 미리 정해두면 좋아요. '지금 아니면 안 될 것 같은' 감각은 대부분 속도의 착시예요. 하루를 두고 다시 봐도 좋아 보이는 것만 잡아요.",
        "축적은 반복에서 와요. 작게 정한 규칙 하나를 이번 흐름 동안 끊기지 않게 지키는 것이, 큰 결심 여러 번보다 멀리 가요.",
        "마지막으로, 돈 이야기를 꺼내기 어려운 자리에서 미루던 정리가 있다면 이번이 매듭짓기 좋은 때예요. 현실적인 선택이 이 장의 열쇠예요.",
      ],
      panels: [
        {
          id: "money-01",
          imageUrl: cut("money-01"),
          alt: "달빛 아래 토끼가 갈림길 앞에서 돈의 흐름을 살피는 장면",
          isPreview: true,
          overlays: [
            { id: "m01-title", type: "title", text: "이번 재물운의 첫 장면", x: 8, y: 6, width: 84, align: "center", tone: "system" },
            { id: "m01-rabbit", type: "speech", text: "지금은 크게 벌 기회보다, 새는 곳을 먼저 발견하는 흐름이야.", tone: "rabbit", ...bubbleAt("left-low") },
          ],
        },
        {
          id: "money-02",
          imageUrl: cut("money-02"),
          alt: "선택지 앞에서 소비와 축적 사이를 고민하는 장면",
          isPreview: true,
          overlays: [
            { id: "m02-caption", type: "caption", text: "기회는 속도보다 방향에서 시작돼요.", x: 12, y: 8, width: 76, align: "center", tone: "system" },
            { id: "m02-subject", type: "speech", text: "이번엔 내가 진짜 필요한 것부터 골라볼까?", tone: "subject", ...bubbleAt("right-low", 1) },
          ],
        },
        {
          id: "money-03",
          imageUrl: cut("money-03"),
          alt: "결심한 토끼가 한 방향으로 나아가는 장면",
          isPreview: false,
          overlays: [
            { id: "m03-rabbit", type: "speech", text: "미루던 자리에서 하나를 정하면, 돈의 흐름도 한 줄로 모여.", tone: "rabbit", ...bubbleAt("left-low") },
          ],
        },
        {
          id: "money-04",
          imageUrl: cut("money-04"),
          alt: "작은 반복이 쌓여 밝아진 결말 장면",
          isPreview: false,
          overlays: [
            { id: "m04-caption", type: "caption", text: "쌓이는 건 큰 한 방이 아니라 반복이에요.", x: 12, y: 8, width: 76, align: "center", tone: "system" },
            { id: "m04-rabbit", type: "speech", text: "네 소비 습관의 결은 아래 상세 분석에서 이어서 볼게.", tone: "rabbit", ...bubbleAt("right-low", 1) },
          ],
        },
      ],
    };
  }

  if (fortuneType === "love") {
    return {
      coverImageUrl: cut("love-cover"),
      previewText: `${nickname}, 이번 연애운은 마음이 먼저 도착해 있는 계절이야. 속도는 네가 정해도 돼.`,
      previewPoints: [
        "표현은 크기보다 타이밍이에요",
        "짧은 안부가 대화의 문을 열어요",
        "감정의 균형은 주고받는 리듬에서 와요",
      ],
      fullParagraphs: [
        `${nickname}의 이번 흐름은 표현의 타이밍이 관계의 온도를 정해요. 준비된 큰 고백보다, 지금 떠오른 짧은 안부가 문을 열어요.`,
        "관계의 속도는 상대와 맞추는 것이 아니라 함께 정하는 거예요. 빨라서 불안하면 늦추자고 말해도 돼요. 그 말을 꺼낼 수 있는 사이가 오래가요.",
        "대화가 열리는 순간을 놓치지 마세요. 상대가 자기 이야기를 꺼낸 날, 조언보다 한 번 더 물어봐 주는 쪽이 마음을 움직여요.",
        "마지막으로, 주는 만큼 받으려는 계산이 서운함을 만들어요. 리듬이 어긋난 날은 총량이 아니라 박자를 다시 맞춰요.",
      ],
      panels: [
        {
          id: "love-01",
          imageUrl: cut("love-01"),
          alt: "달빛 아래 두 마음이 가까워지는 첫 장면",
          isPreview: true,
          overlays: [
            { id: "l01-title", type: "title", text: "이번 연애운의 첫 장면", x: 8, y: 6, width: 84, align: "center", tone: "system" },
            { id: "l01-rabbit", type: "speech", text: "마음이 먼저 도착해 있는 계절이야. 속도는 네가 정해도 돼.", tone: "rabbit", ...bubbleAt("left-low") },
          ],
        },
        {
          id: "love-02",
          imageUrl: cut("love-02"),
          alt: "연락을 기다리며 마음을 고르는 장면",
          isPreview: true,
          overlays: [
            { id: "l02-caption", type: "caption", text: "표현은 크기보다 타이밍이에요.", x: 12, y: 8, width: 76, align: "center", tone: "system" },
            { id: "l02-subject", type: "speech", text: "먼저 안부를 물어봐도 괜찮을까?", tone: "subject", ...bubbleAt("left-low", 1) },
          ],
        },
        {
          id: "love-03",
          imageUrl: cut("love-03"),
          alt: "대화가 열려 온기가 도는 장면",
          isPreview: false,
          overlays: [
            { id: "l03-rabbit", type: "speech", text: "대화가 열리는 순간을 놓치지 마. 짧은 안부가 문을 열어.", tone: "rabbit", ...bubbleAt("right-low") },
          ],
        },
        {
          id: "love-04",
          imageUrl: cut("love-04"),
          alt: "주고받는 리듬이 맞아 편안해진 결말 장면",
          isPreview: false,
          overlays: [
            { id: "l04-caption", type: "caption", text: "감정의 균형은 주고받는 리듬에서 와요.", x: 12, y: 8, width: 76, align: "center", tone: "system" },
            { id: "l04-rabbit", type: "speech", text: "관계의 속도 이야기는 아래 상세 분석에서 이어서 볼게.", tone: "rabbit", ...bubbleAt("left-low", 1) },
          ],
        },
      ],
    };
  }

  // breakup — 이별을 확정적으로 예언하지 않는다. 지금을 돌보는 선택으로만 말한다.
  return {
    coverImageUrl: cut("breakup-cover"),
    previewText: `${nickname}, 이 장은 끝을 점치는 장이 아니야. 지금 마음의 거리를 재고, 나를 돌보는 순서를 찾는 장이야.`,
    previewPoints: [
      "미련은 지워야 할 게 아니라 읽어야 할 신호예요",
      "거리를 두는 건 관계를 버리는 게 아니에요",
      "회복은 나를 돌보는 선택에서 시작돼요",
    ],
    fullParagraphs: [
      `${nickname}이(가) 지금 붙잡고 있는 것이 사람인지, 그 시절의 나인지 먼저 구분해 보세요. 미련은 지워야 할 얼룩이 아니라, 내가 무엇을 원했는지 알려주는 신호예요.`,
      "거리 조절은 관계를 끝내는 기술이 아니라 나를 지키는 기술이에요. 답장 속도, 만나는 빈도 같은 작은 다이얼부터 내 손에 돌려놓아요.",
      "관계를 이어갈지 매듭지을지는 이 글이 정해주지 않아요. 다만 어느 쪽을 고르든, 그 선택이 두려움이 아니라 돌봄에서 나오게 하는 것이 이번 흐름의 숙제예요.",
      "회복의 순서는 단순해요. 잘 자고, 잘 먹고, 나를 웃게 하는 사람을 가까이 두는 것. 마음의 근육이 돌아오면 판단은 훨씬 쉬워져요.",
    ],
    panels: [
      {
        id: "breakup-01",
        imageUrl: cut("breakup-01"),
        alt: "금이 간 마음의 거리를 가늠하는 첫 장면",
        isPreview: true,
        overlays: [
          { id: "b01-title", type: "title", text: "이번 이별운의 첫 장면", x: 8, y: 6, width: 84, align: "center", tone: "system" },
          { id: "b01-rabbit", type: "speech", text: "끝을 점치는 장이 아니야. 지금 마음의 거리를 재는 장이야.", tone: "rabbit", ...bubbleAt("left-low") },
        ],
      },
      {
        id: "breakup-02",
        imageUrl: cut("breakup-02"),
        alt: "지난 마음을 돌아보며 그리움을 읽는 장면",
        isPreview: true,
        overlays: [
          { id: "b02-caption", type: "caption", text: "미련은 지워야 할 게 아니라 읽어야 할 신호예요.", x: 10, y: 8, width: 80, align: "center", tone: "system" },
          { id: "b02-subject", type: "speech", text: "나는 지금 무엇을 붙잡고 있을까?", tone: "subject", ...bubbleAt("right-low", 1) },
        ],
      },
      {
        id: "breakup-03",
        imageUrl: cut("breakup-03"),
        alt: "거리를 두고 자신을 돌보기 시작하는 장면",
        isPreview: false,
        overlays: [
          { id: "b03-rabbit", type: "speech", text: "거리를 두는 건 버리는 게 아니라, 나를 돌보는 방법일 수 있어.", tone: "rabbit", ...bubbleAt("left-low") },
        ],
      },
      {
        id: "breakup-04",
        imageUrl: cut("breakup-04"),
        alt: "밝아진 빛 속에서 회복을 시작하는 결말 장면",
        isPreview: false,
        overlays: [
          { id: "b04-caption", type: "caption", text: "회복은 언제나 나를 돌보는 선택에서 시작돼요.", x: 10, y: 8, width: 80, align: "center", tone: "system" },
          { id: "b04-rabbit", type: "speech", text: "회복의 순서는 아래 상세 분석에서 이어서 볼게.", tone: "rabbit", ...bubbleAt("right-low", 1) },
        ],
      },
    ],
  };
}

/**
 * 잠금 상태에 맞춰 패널을 자른다. 잠겨 있으면 뒤 패널은 그림만 남기고
 * 오버레이(문장)를 비운다 — 유료 문장이 미해금 응답으로 새지 않게.
 */
export function panelsForState(panels: WebtoonPanelData[], unlocked: boolean): WebtoonPanelData[] {
  if (unlocked) return panels;
  return panels.map((p, i) =>
    i < FREE_PANEL_COUNT ? p : { ...p, overlays: [] }
  );
}

/**
 * 공유 문구. 리딩 id·생년월일·시각 같은 개인 값은 넣지 않는다 —
 * 결과 페이지는 본인만 열 수 있어서 링크는 홈으로 보낸다.
 */
export function buildShareText(fortuneType: FortuneType): { text: string; path: string } {
  const label = WEBTOON_FORTUNE_CONFIG[fortuneType].label;
  return {
    text: `러브레빗에서 내 ${label}을 웹툰으로 봤어. 너도 해봐 🐰`,
    path: "/",
  };
}

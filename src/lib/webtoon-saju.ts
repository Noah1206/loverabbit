// 웹툰 사주 — 순수 데이터와 계산만. 서버 검증은 /api/webtoon-readings, 화면은 /webtoon-saju.
//
// **주인공은 없다. 토끼가 혼자 이야기한다.**
//
// 처음에는 사용자를 뒷모습으로 그렸다. 그러면 성별·나이·체형을 매번 가정하게 되고,
// 어느 쪽으로 그려도 절반은 "내가 아니다". 사람을 아예 빼니 그 문제가 사라졌고,
// 누구에게나 자기 이야기가 된다. 사용자는 이름으로만 불린다.
//
// 한 편은 8컷이다. 말하는 얼굴만 이어지면 대화록이지 웹툰이 아니라서,
// 화자 컷 사이에 배경·소품 컷을 끼워 흐름을 만든다.
//
//   01 맞이함(화자) 02 전환(배경) 03 짚어줌(화자)   ← 무료
//   04 소품(정물)   05 걱정함(화자) 06 경과(배경)
//   07 풀어줌(화자) 08 배웅함(화자)                  ← 유료
//
// 텍스트는 이미지에 굽지 않는다 — 오버레이가 별도 DOM 층으로 그린다.
// 그래서 카피·이름·화법을 바꿔도 이미지 재생성이 없다.

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

/**
 * 무료로 보여주는 앞 컷 수.
 *
 * 3 인 이유: 01 맞이함 → 02 전환 → 03 짚어줌 까지가 "이야기가 시작됐다"로 읽힌다.
 * 2 에서 끊으면 인사만 하고 끝나서 살 이유가 안 생긴다.
 */
export const FREE_PANEL_COUNT = 3;

/**
 * 원장 ref. (reason='reading', ref) unique 인덱스가 해금 상태의 정본이자
 * 멱등 키다 — 같은 ref 로 두 번 차감되지 않고, 별도 해금 테이블도 필요 없다.
 */
export function webtoonUnlockRef(readingId: string, fortuneType: FortuneType): string {
  return `webtoon:${readingId}:${fortuneType}`;
}

export interface TextOverlay {
  id: string;
  type: "speech" | "caption" | "title" | "label" | "sfx";
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
 * 말풍선의 폭 (패널 가로 대비 %).
 */
export const BUBBLE_WIDTH = 52;

/**
 * 말풍선 몸통의 높이 (패널 세로 대비 %).
 *
 * 손으로 정하지 않고 폭에서 유도한다. SVG 몸통이 200x130 이고 패널이 1024x1365 이므로
 * 세로 비율은 폭 × (130/200) × (1024/1365) 이다. 이 값을 눈대중으로 17% 라고 뒀다가
 * 두 말풍선이 8% 겹쳤다 — 화면에서 테두리가 서로 물려 보였다.
 */
export const BUBBLE_BODY_HEIGHT = BUBBLE_WIDTH * (130 / 200) * (1024 / 1365);

/** 말풍선 사이 간격. 몸통 높이에 여유 2%. */
export const BUBBLE_GAP = BUBBLE_BODY_HEIGHT + 2;

/**
 * n 번째 말풍선의 자리.
 *
 * 그림의 위쪽 45% 가 비어 있다는 것이 이미지 쪽 계약이다(assets README).
 * 그래서 좌표를 그림마다 계산할 필요가 없다 — 위에서부터 순서대로 쌓으면 된다.
 *
 * **꼬리는 마지막 말풍선에만 단다.** 연속 대사에 전부 꼬리를 달면 앞 풍선의
 * 꼬리가 뒤 풍선을 뚫는다. 웹툰의 관행이기도 하다 — 누가 말하는지는 마지막
 * 꼬리 하나면 충분하다.
 */
export function bubbleAt(
  side: "left" | "right",
  index = 0,
  total = 1
): Pick<TextOverlay, "x" | "y" | "width" | "align" | "tail"> {
  const last = index === total - 1;
  const x = side === "left" ? 4 + index * 6 : 44 - index * 6;
  return {
    x,
    y: 3 + index * BUBBLE_GAP,
    width: BUBBLE_WIDTH,
    align: "center",
    tail: last ? (side === "left" ? "bottom-left" : "bottom-right") : undefined,
  };
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
 * 한 컷의 재료. buildWebtoonContent 가 이걸 오버레이로 편다.
 *
 *   lines  화자의 말. 여러 줄이면 위에서부터 쌓이고 마지막에만 꼬리가 붙는다.
 *   side   말풍선이 앉을 쪽. 화자가 오른쪽에 있으면 "left" 로 피한다.
 *   cap    화자 없는 컷의 한 줄. 말풍선 대신 상단 띠로 나간다.
 *   sfx    효과음. 이미지에 굽지 않고 오버레이로 얹는다.
 */
interface CutSpec {
  id: string;
  alt: string;
  free: boolean;
  side?: "left" | "right";
  lines?: string[];
  cap?: string;
  sfx?: string;
}

/**
 * 컷 하나를 오버레이가 얹힌 패널로 편다.
 *
 * 좌표는 여기서 한 번만 계산된다 — 컷 데이터에는 % 가 없다. 그림의 위쪽이
 * 비어 있다는 계약(assets README) 위에서 bubbleAt 이 자리를 정한다.
 */
function toPanel(spec: CutSpec): WebtoonPanelData {
  const overlays: TextOverlay[] = [];
  const lines = spec.lines ?? [];

  if (spec.cap) {
    overlays.push({
      id: `${spec.id}-cap`,
      type: "caption",
      text: spec.cap,
      x: 8,
      y: 6,
      width: 84,
      align: "center",
      tone: "system",
    });
  }

  lines.forEach((text, i) => {
    overlays.push({
      id: `${spec.id}-say-${i}`,
      type: "speech",
      text,
      tone: "rabbit",
      ...bubbleAt(spec.side ?? "left", i, lines.length),
    });
  });

  if (spec.sfx) {
    // 말풍선 반대편, 마지막 풍선 아래. 겹칠 자리가 없다.
    const opposite = (spec.side ?? "left") === "left" ? 70 : 6;
    overlays.push({
      id: `${spec.id}-sfx`,
      type: "sfx",
      text: spec.sfx,
      x: opposite,
      y: 3 + lines.length * BUBBLE_GAP + 3,
      width: 24,
      align: "left",
      tone: "system",
    });
  }

  return {
    id: spec.id,
    imageUrl: cut(spec.id),
    alt: spec.alt,
    overlays,
    isPreview: spec.free,
  };
}

/** 무료로 보여주는 앞 컷 수 — 맞이함·전환·짚어줌까지 */
const EPISODES: Record<FortuneType, { cover: string; cuts: CutSpec[] }> = {
  money: {
    cover: "money-01",
    cuts: [
      { id: "money-01", free: true, side: "left", alt: "토끼가 손을 들어 인사하는 장면",
        lines: ["{nick}님,\n만나서 반가워요", "지금부터 재물의\n흐름을 풀어드릴게요"], sfx: "방긋" },
      { id: "money-02", free: true, alt: "등불이 늘어선 밤거리",
        cap: "기회는 속도보다 방향에서\n시작돼요" },
      { id: "money-03", free: true, side: "right", alt: "진지한 표정으로 바라보는 토끼",
        lines: ["먼저 꼭\n짚어야 할 게 있어요"] },
      { id: "money-04", free: false, alt: "탁자 위의 동전주머니와 붓",
        cap: "새는 곳을 먼저 찾으면\n흐름이 한 줄로 모여요" },
      { id: "money-05", free: false, side: "left", alt: "조심스러운 표정으로 짚어 주는 토끼",
        lines: ["여기, 이 부분만\n조심하면 돼요"], sfx: "톡톡" },
      { id: "money-06", free: false, alt: "새벽빛이 드는 창가",
        cap: "쌓이는 건 큰 한 방이 아니라\n반복이에요" },
      { id: "money-07", free: false, side: "left", alt: "부드럽게 웃으며 권하는 토끼",
        lines: ["미루던 자리에서\n하나를 정해보세요"] },
      { id: "money-08", free: false, side: "left", alt: "윙크하며 배웅하는 토끼",
        lines: ["나머지도\n이어서 볼까요?"], sfx: "찡긋" },
    ],
  },
  love: {
    cover: "love-01",
    cuts: [
      { id: "love-01", free: true, side: "right", alt: "벚꽃 아래에서 반기는 토끼",
        lines: ["{nick}님,\n기다리고 있었어요", "마음이 먼저 도착해\n있는 계절이에요"], sfx: "방긋" },
      { id: "love-02", free: true, alt: "벚꽃이 흩날리는 밤길",
        cap: "표현은 크기보다\n타이밍이에요" },
      { id: "love-03", free: true, side: "right", alt: "놀란 듯 눈을 크게 뜬 토끼",
        lines: ["어머, 이 흐름은\n좀 특별한데요?"], sfx: "두근" },
      { id: "love-04", free: false, alt: "김이 오르는 찻잔 두 개",
        cap: "짧은 안부 하나가\n문을 열어요" },
      { id: "love-05", free: false, side: "left", alt: "차분히 마음을 짚어 주는 토끼",
        lines: ["속도는 {nick}님이\n정해도 괜찮아요"] },
      { id: "love-06", free: false, alt: "보름달이 뜬 밤하늘",
        cap: "감정의 균형은 주고받는\n리듬에서 와요" },
      { id: "love-07", free: false, side: "right", alt: "따뜻하게 웃으며 권하는 토끼",
        lines: ["대화가 열리는 순간을\n놓치지 마세요"] },
      { id: "love-08", free: false, side: "right", alt: "윙크하며 배웅하는 토끼",
        lines: ["나머지 이야기도\n들어보실래요?"], sfx: "찡긋" },
    ],
  },
  breakup: {
    cover: "breakup-01",
    cuts: [
      { id: "breakup-01", free: true, side: "right", alt: "조심스러운 표정으로 말을 꺼내는 토끼",
        lines: ["{nick}님,\n조심스레 꺼내볼게요", "끝을 점치는 자리는\n아니에요"] },
      { id: "breakup-02", free: true, alt: "비가 흐르는 밤 창문",
        cap: "미련은 지워야 할 게 아니라\n읽어야 할 신호예요" },
      { id: "breakup-03", free: true, side: "right", alt: "생각에 잠긴 토끼",
        lines: ["지금 무엇을\n붙잡고 계신가요"] },
      { id: "breakup-04", free: false, alt: "탁자 위의 촛대와 나무 상자",
        cap: "거리를 두는 건\n버리는 게 아니에요" },
      { id: "breakup-05", free: false, side: "right", alt: "말없이 이해하는 표정의 토끼",
        lines: ["그 마음, 저는\n알 것 같아요"] },
      { id: "breakup-06", free: false, alt: "비가 갠 새벽 하늘",
        cap: "비는 언젠가\n그치더라고요" },
      { id: "breakup-07", free: false, side: "left", alt: "찻잔을 건네는 토끼의 앞발",
        lines: ["잠깐 쉬어가도\n괜찮아요"], sfx: "호록" },
      { id: "breakup-08", free: false, side: "right", alt: "아침 빛 속에서 배웅하는 토끼",
        lines: ["회복의 순서를\n알려드릴게요"], sfx: "방긋" },
    ],
  },
};

/** 운세별 미리보기 문장과 상세 분석 */
const TEXTS: Record<FortuneType, { preview: string; points: string[]; full: string[] }> = {
  money: {
    preview: "{nick}님, 이번 재물운은 큰 한 방보다 방향을 잡는 장이에요. 새는 곳을 먼저 찾으면 흐름이 한 줄로 모여요.",
    points: ["방향이 먼저예요", "새는 곳을 봐요", "반복이 쌓여요"],
    full: [
      "{nick}님의 이번 흐름에서 먼저 볼 것은 들어오는 돈이 아니라 나가는 돈의 결이에요. 어디서 새는지 아는 순간, 같은 수입으로도 손에 남는 양이 달라져요.",
      "기회가 왔을 때의 판단 기준을 미리 정해두면 좋아요. 지금 아니면 안 될 것 같은 감각은 대부분 속도의 착시예요. 하루를 두고 다시 봐도 좋아 보이는 것만 잡아요.",
      "축적은 반복에서 와요. 작게 정한 규칙 하나를 이번 흐름 동안 끊기지 않게 지키는 것이, 큰 결심 여러 번보다 멀리 가요.",
      "마지막으로, 돈 이야기를 꺼내기 어려운 자리에서 미루던 정리가 있다면 이번이 매듭짓기 좋은 때예요. 현실적인 선택이 이 장의 열쇠예요.",
    ],
  },
  love: {
    preview: "{nick}님, 이번 연애운은 마음이 먼저 도착해 있는 계절이에요. 속도는 {nick}님이 정해도 괜찮아요.",
    points: ["표현은 타이밍이에요", "짧은 안부가 문을 열어요", "리듬을 맞춰요"],
    full: [
      "{nick}님의 이번 흐름은 표현의 타이밍이 관계의 온도를 정해요. 준비된 큰 고백보다, 지금 떠오른 짧은 안부가 문을 열어요.",
      "관계의 속도는 상대와 맞추는 것이 아니라 함께 정하는 거예요. 빨라서 불안하면 늦추자고 말해도 돼요. 그 말을 꺼낼 수 있는 사이가 오래가요.",
      "대화가 열리는 순간을 놓치지 마세요. 상대가 자기 이야기를 꺼낸 날, 조언보다 한 번 더 물어봐 주는 쪽이 마음을 움직여요.",
      "마지막으로, 주는 만큼 받으려는 계산이 서운함을 만들어요. 리듬이 어긋난 날은 총량이 아니라 박자를 다시 맞춰요.",
    ],
  },
  breakup: {
    preview: "{nick}님, 이 장은 끝을 점치는 자리가 아니에요. 지금 마음의 거리를 재고, 나를 돌보는 순서를 찾는 장이에요.",
    points: ["미련은 신호예요", "거리는 돌봄이에요", "회복엔 순서가 있어요"],
    full: [
      "{nick}님이 지금 붙잡고 있는 것이 사람인지, 그 시절의 나인지 먼저 구분해 보세요. 미련은 지워야 할 얼룩이 아니라, 내가 무엇을 원했는지 알려주는 신호예요.",
      "거리 조절은 관계를 끝내는 기술이 아니라 나를 지키는 기술이에요. 답장 속도, 만나는 빈도 같은 작은 다이얼부터 내 손에 돌려놓아요.",
      "관계를 이어갈지 매듭지을지는 이 글이 정해주지 않아요. 다만 어느 쪽을 고르든, 그 선택이 두려움이 아니라 돌봄에서 나오게 하는 것이 이번 흐름의 숙제예요.",
      "회복의 순서는 단순해요. 잘 자고, 잘 먹고, 나를 웃게 하는 사람을 가까이 두는 것. 마음의 근육이 돌아오면 판단은 훨씬 쉬워져요.",
    ],
  },
};

/** {nick} 자리에 별명을 넣는다. 사용자는 그림에 없고 이름으로만 불린다. */
const fill = (text: string, nickname: string) => text.replaceAll("{nick}", nickname);

/**
 * 운세 한 편. 토끼가 8컷 동안 혼자 이야기한다.
 *
 * v1 은 흐름 안내형 고정 카피다 — 점수·날짜·간지 같은 명리 값을 지어내지 않는다.
 * 명식 기반 문장은 webtoon-generate.ts 가 이 위에 덮어쓴다.
 */
export function buildWebtoonContent(fortuneType: FortuneType, nickname: string): WebtoonContent {
  const ep = EPISODES[fortuneType];
  const t = TEXTS[fortuneType];
  return {
    coverImageUrl: cut(ep.cover),
    previewText: fill(t.preview, nickname),
    previewPoints: t.points,
    fullParagraphs: t.full.map((x) => fill(x, nickname)),
    panels: ep.cuts.map((spec) =>
      toPanel({
        ...spec,
        lines: spec.lines?.map((l) => fill(l, nickname)),
      })
    ),
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

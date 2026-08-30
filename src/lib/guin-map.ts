// 귀인 지도 — 타입·역할 사전·입력 검증·화면용 정리.
//
// 이 파일은 클라이언트와 서버가 같이 본다. DB 나 node 전용 모듈을 여기서
// import 하지 마라 — 그건 guin-db.ts(서버)와 guin-token.ts(서버)의 몫이다.
//
// 문구 원칙 (지시문 10항): 운명·반드시·절대·확정 같은 단정을 쓰지 않는다.
// 부정적인 역할명을 만들지 않는다. 결과는 재미와 대화 소재다 — 화면 하단
// 고지(GUIN_DISCLAIMER)가 그 성격을 밝힌다.

export type GuinRole =
  | "benefactor"
  | "right_hand"
  | "growth_teacher"
  | "mirror"
  | "stimulator"
  | "comforter"
  | "neutral";

export interface GuinRoleInfo {
  label: string;
  /** 점수보다 먼저 읽히는 한 줄 (지시문 11항: 캐릭터가 점수보다 앞) */
  tagline: string;
  strengths: string[];
  cautions: string[];
  conversationPrompt: string;
}

/**
 * 역할 사전. 역할은 "상대 일간이 내 일간에게 무슨 십성인가"로 정해진다
 * (guin-calc.ts). 문구는 전부 여기 있고, 계산이 문구를 만들지 않는다 —
 * 표현을 고칠 일이 생기면 이 표만 고치면 된다.
 */
export const GUIN_ROLES: Record<GuinRole, GuinRoleInfo> = {
  benefactor: {
    label: "귀인",
    tagline: "나를 살리는 사람",
    strengths: [
      "지쳤을 때 기운을 채워 주기 쉬운 조합이에요",
      "말하지 않아도 필요한 걸 먼저 알아채는 쪽이에요",
    ],
    cautions: ["받는 게 익숙해지면 고마움을 말로 전할 기회를 놓치기 쉬워요"],
    conversationPrompt: "요즘 나한테 제일 힘이 됐던 순간이 언제였는지 서로 말해볼까?",
  },
  right_hand: {
    label: "오른팔",
    tagline: "현실적으로 내 편이 되는 사람",
    strengths: [
      "계획을 실제로 굴러가게 만드는 실행력이 잘 붙어요",
      "현실 감각을 서로 보태 주는 조합이에요",
    ],
    cautions: ["한쪽이 혼자 결정하려 하면 거리감이 생기기 쉬워요"],
    conversationPrompt: "우리가 서로에게 가장 도움이 됐던 순간은 언제였을까?",
  },
  growth_teacher: {
    label: "성장형 선생",
    tagline: "나를 키우는 자극을 주는 사람",
    strengths: [
      "느슨해질 때 기준을 다시 세워 주는 관계예요",
      "같이 있으면 목표가 또렷해지는 쪽이에요",
    ],
    cautions: ["조언이 잦아지면 잔소리로 들리는 날이 있어요 — 타이밍이 반이에요"],
    conversationPrompt: "서로에게 배운 것 중 제일 오래 남은 게 뭔지 물어볼까?",
  },
  mirror: {
    label: "거울형",
    tagline: "나의 모습을 비춰주는 사람",
    strengths: [
      "설명 없이도 서로를 이해하는 속도가 빨라요",
      "비슷한 결이라 같이 있는 게 편해요",
    ],
    cautions: ["닮은 만큼 같은 지점에서 같이 고집이 세질 수 있어요"],
    conversationPrompt: "남들은 모르는데 우리 둘만 아는 서로의 습관이 있을까?",
  },
  stimulator: {
    label: "자극형",
    tagline: "새로운 방향을 열어주는 사람",
    strengths: [
      "혼자서는 안 하던 시도를 하게 만드는 관계예요",
      "생각의 반경을 넓혀 주는 쪽이에요",
    ],
    cautions: ["속도가 서로 다른 날엔 잠깐 페이스를 맞추는 게 좋아요"],
    conversationPrompt: "서로 덕분에 처음 해 본 게 뭐가 있는지 세어 볼까?",
  },
  comforter: {
    label: "안식처",
    tagline: "긴장을 풀고 쉬게 하는 사람",
    strengths: [
      "같이 있으면 애쓰지 않아도 되는 편안함이 있어요",
      "기분이 가라앉은 날 제일 먼저 생각나는 쪽이에요",
    ],
    cautions: ["편한 게 당연해지면 고마운 마음을 표현할 틈이 줄어요"],
    conversationPrompt: "서로한테 제일 편해지는 순간이 언제인지 이야기해 볼까?",
  },
  neutral: {
    label: "동행",
    tagline: "결이 다른 만큼 배울 게 많은 사람",
    strengths: ["서로 다른 시선이라 대화가 새로워요"],
    cautions: ["다름을 틀림으로 읽지 않게 한 박자 쉬어 가요"],
    conversationPrompt: "서로 제일 다르다고 느끼는 지점이 어디인지 말해 볼까?",
  },
};

/** 결과 하단 고지 — 판단을 대체하지 않는다는 성격 표시 */
export const GUIN_DISCLAIMER =
  "귀인 지도는 사주 구성을 재미와 대화 소재로 풀어 본 해석이에요. 실제 관계에 대한 판단을 대신하지 않아요.";

export interface GuinBirthInput {
  year: number;
  month: number;
  day: number;
  /** 모름이면 null. 시간은 관계 점수에 안 들어가고 개인 캐릭터에만 쓴다. */
  hour: number | null;
}

export interface GuinRelationshipResult {
  score: number;
  role: GuinRole;
  roleLabel: string;
  roleTagline: string;
  /** 상대 일간의 오행 캐릭터 — "번지는 불" 등 */
  elementLabel: string;
  strengths: string[];
  cautions: string[];
  conversationPrompt: string;
  /** 점수의 근거가 된 관계 사실 라벨 (합·충 등) */
  facts: string[];
  calculationVersion: string;
}

// ── 입력 검증 ─────────────────────────────────────────────

/**
 * 별명 검사. 문제가 없으면 null, 있으면 사용자에게 보여줄 문장.
 *
 * 전화번호·주소·연락처 패턴은 이유를 구체적으로 짚지 않는다(지시문 5항) —
 * "이런 게 전화번호처럼 보여요"라고 알려주는 것 자체가 힌트가 된다.
 */
export function nicknameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 1) return "별명을 입력해 주세요.";
  if (name.length > 20) return "별명은 20자 안으로 부탁해요.";
  if (/[\u0000-\u001f\u007f]/.test(name)) return "쓸 수 없는 문자가 들어 있어요.";
  const digits = name.replace(/\D/g, "");
  if (digits.length >= 6) return "다른 사람에게 공개될 수 있는 정보는 입력하지 마세요.";
  if (/01[016789][ .-]?\d{3,4}[ .-]?\d{4}/.test(name))
    return "다른 사람에게 공개될 수 있는 정보는 입력하지 마세요.";
  if (/@|https?:|www\.|\.com|\.kr/i.test(name))
    return "다른 사람에게 공개될 수 있는 정보는 입력하지 마세요.";
  if (/\d+\s*(번지|동\s*\d|호)/.test(name))
    return "다른 사람에게 공개될 수 있는 정보는 입력하지 마세요.";
  return null;
}

/** 양력 생년월일 검사. 문제가 없으면 null. (음력은 화면에서 변환한 뒤에 온다) */
export function birthProblem(birth: GuinBirthInput): string | null {
  const { year, month, day, hour } = birth;
  if (!Number.isInteger(year) || year < 1930 || year > new Date().getFullYear())
    return "출생 연도를 확인해 주세요.";
  if (!Number.isInteger(month) || month < 1 || month > 12) return "월을 확인해 주세요.";
  if (!Number.isInteger(day) || day < 1 || day > 31) return "일을 확인해 주세요.";
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return "없는 날짜예요.";
  if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23))
    return "태어난 시간을 확인해 주세요.";
  return null;
}

// ── 화면용 정리 ───────────────────────────────────────────

export interface GuinNodeView {
  id: string;
  nickname: string;
  role: GuinRole;
  roleLabel: string;
  roleTagline: string;
  elementLabel: string;
  /** show_scores 가 꺼져 있으면 주인이 아닌 화면에는 null 로 나간다 */
  score: number | null;
  strengths: string[];
  cautions: string[];
  conversationPrompt: string;
  facts: string[];
}

export interface GuinMapView {
  token: string;
  ownerNickname: string;
  showScores: boolean;
  count: number;
  /** 역할별 인원 — 낯선 방문자(참여 전)에게 보여줄 수 있는 전부 */
  roleCounts: Partial<Record<GuinRole, number>>;
  /** 참여 전 방문자에게는 비어 있다 — 지도는 참여해야 보인다 (지시문 3.5) */
  nodes: GuinNodeView[];
  viewer: "owner" | "participant" | "stranger";
}

/**
 * 지도 한 장을 보는 사람에 맞춰 자른다.
 *
 * 낯선 방문자는 노드를 받지 못한다 — 화면에서 가리는 게 아니라 응답에서
 * 뺀다. 점수 숨김도 같다: showScores 가 꺼지면 주인 아닌 모든 화면에서
 * score 가 null 로 나간다. 주인은 자기 설정과 무관하게 다 본다.
 */
export function shapeMapView(params: {
  token: string;
  ownerNickname: string;
  showScores: boolean;
  nodes: GuinNodeView[];
  viewer: "owner" | "participant" | "stranger";
}): GuinMapView {
  const { token, ownerNickname, showScores, nodes, viewer } = params;
  const roleCounts: Partial<Record<GuinRole, number>> = {};
  for (const node of nodes) roleCounts[node.role] = (roleCounts[node.role] ?? 0) + 1;
  const visible =
    viewer === "stranger"
      ? []
      : viewer === "owner" || showScores
        ? nodes
        : nodes.map((node) => ({ ...node, score: null }));
  return { token, ownerNickname, showScores, count: nodes.length, roleCounts, nodes: visible, viewer };
}

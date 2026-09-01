// 귀인 지도 — 타입·역할 사전·입력 검증·화면용 정리.
//
// 이 파일은 클라이언트와 서버가 같이 본다. DB 나 node 전용 모듈을 여기서
// import 하지 마라 — 그건 guin-db.ts(서버)와 guin-token.ts(서버)의 몫이다.
//
// 문구 원칙 (지시문 10항): 운명·반드시·절대·확정 같은 단정을 쓰지 않는다.
// 부정적인 역할명을 만들지 않는다. 결과는 재미와 대화 소재다 — 화면 하단
// 고지(GUIN_DISCLAIMER)가 그 성격을 밝힌다.

export type GuinRole =
  // guin-v2 — 관계 축 4개에서 나오는 네 역할
  | "comforter"
  | "right_hand"
  | "communicator"
  | "growth_teacher"
  // guin-1 — 소급 변경하지 않는 옛 역할 (저장된 지도를 그대로 그리기 위해 남긴다)
  | "benefactor"
  | "mirror"
  | "stimulator"
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
    label: "오른팔형",
    tagline: "현실적으로 내 편이 되어주는 사람",
    strengths: ["생각을 실제 행동으로 옮길 때 서로에게 현실적인 힘이 되어주는 관계예요"],
    cautions: ["도움을 주고받는 방식을 구체적으로 말하면 더 편해져요"],
    conversationPrompt: "내가 요즘 가장 현실적으로 도움받고 싶은 것은 무엇일까?",
  },
  growth_teacher: {
    label: "성장형",
    tagline: "새로운 방향과 자극을 주는 사람",
    strengths: ["익숙한 방식에서 벗어나 새로운 시각을 열어주는 관계예요"],
    cautions: ["다름을 곧바로 충돌로 해석하지 말고 배울 점을 찾아보세요"],
    conversationPrompt: "이 관계가 나에게 새롭게 보여준 것은 무엇일까?",
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
    label: "안식처형",
    tagline: "마음을 편하게 해주는 사람",
    strengths: ["함께 있을 때 긴장이 풀리고 서로의 속도를 이해하기 쉬운 관계예요"],
    cautions: ["문제를 바로 해결하려 하기보다 먼저 서로의 이야기를 들어주세요"],
    conversationPrompt: "요즘 서로에게 가장 편안했던 순간은 언제였을까?",
  },
  communicator: {
    label: "대화형",
    tagline: "서로의 생각을 풀어내기 쉬운 사람",
    strengths: ["말을 주고받으며 서로의 생각을 정리하기 쉬운 관계예요"],
    cautions: ["정답을 정하기보다 각자의 해석을 먼저 말해보세요"],
    conversationPrompt: "우리가 서로를 가장 잘 이해했던 대화는 무엇이었을까?",
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
  /** 점수 구간 표현 (scoreBandOf). 옛(guin-1) 결과에는 없다. */
  scoreBand?: string;
  role: GuinRole;
  roleLabel: string;
  roleTagline: string;
  /** 1위 축과 5점 미만 차이인 보조 역할 — 억지로 하나만 고르지 않는다 */
  secondaryRole?: GuinRole | null;
  secondaryRoleLabel?: string | null;
  /** 네 관계 축 점수 (guin-v2). 옛 결과에는 없다. */
  axes?: GuinAxes | null;
  /** 상대 일간의 오행 캐릭터 — "번지는 불" 등 */
  elementLabel: string;
  strengths: string[];
  cautions: string[];
  conversationPrompt: string;
  /** 점수의 근거 라벨 (guin-1 의 합·충 등. v2 는 비어 있다) */
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
  // 동의 문구가 "만 14세 이상만"이라고 약속한다 — 문구만 있고 검사가 없으면
  // 그 약속은 거짓말이다. 이 함수는 폼과 서버 라우트가 같이 쓰므로 여기 한 번이면 된다.
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getFullYear() - 14, now.getMonth(), now.getDate()));
  if (d.getTime() > cutoff.getTime()) return "만 14세 이상만 이용할 수 있어요.";
  return null;
}

// ── 화면용 정리 ───────────────────────────────────────────

export interface GuinNodeView {
  id: string;
  nickname: string;
  role: GuinRole;
  roleLabel: string;
  roleTagline: string;
  secondaryRoleLabel?: string | null;
  elementLabel: string;
  /** show_scores 가 꺼져 있으면 주인이 아닌 화면에는 null 로 나간다 */
  score: number | null;
  scoreBand?: string;
  /** 네 관계 축 — guin-1 노드에는 없다. 비교·패턴 화면은 있는 노드만 쓴다. */
  axes?: GuinAxes | null;
  strengths: string[];
  cautions: string[];
  conversationPrompt: string;
  facts: string[];
  /**
   * 역방향(참여자에게 주인은 무엇인가) — guin-v3. 옛 행에는 없다.
   * relate 를 두 번 돌린 별도 계산이지, 정방향을 뒤집은 문구가 아니다.
   * score 는 지도 설정(showScores)이 꺼져 있으면 정방향과 똑같이 null 로 나간다.
   */
  reverse?: (Omit<GuinRelationshipResult, "score"> & { score: number | null }) | null;
  /** 참여자가 고른 실제 관계 상태 — 축 점수에는 관여하지 않는다 */
  contextStatus?: GuinRelStatus | null;
  /** 검증을 통과해 저장된 AI 리포트. 없으면 화면은 템플릿 카드가 전부다. */
  aiReport?: GuinAiReport | null;
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
 *
 * 관계 상태·AI 리포트(guin-v3)는 그 관계의 두 당사자(주인, 그 참여자 본인)
 * 것이다 — 다른 참여자에게는 응답에서 뺀다. "갈등 중" 같은 상태가 제3자에게
 * 보이면 안 된다.
 */
export function shapeMapView(params: {
  token: string;
  ownerNickname: string;
  showScores: boolean;
  nodes: GuinNodeView[];
  viewer: "owner" | "participant" | "stranger";
  /** viewer 가 participant 일 때 그 사람의 노드 id — 자기 상태·리포트만 남긴다 */
  selfParticipantId?: string | null;
}): GuinMapView {
  const { token, ownerNickname, showScores, nodes, viewer, selfParticipantId } = params;
  const roleCounts: Partial<Record<GuinRole, number>> = {};
  for (const node of nodes) roleCounts[node.role] = (roleCounts[node.role] ?? 0) + 1;
  const scored =
    viewer === "stranger"
      ? []
      : viewer === "owner" || showScores
        ? nodes
        : nodes.map((node) => ({
            ...node,
            score: null,
            // 역방향 점수도 같이 가린다 — 앞은 가리고 뒤로 새면 설정이 거짓말이 된다.
            reverse: node.reverse ? { ...node.reverse, score: null, axes: null } : node.reverse,
          }));
  const visible =
    viewer === "owner"
      ? scored
      : scored.map((node) =>
          node.id === selfParticipantId ? node : { ...node, contextStatus: null, aiReport: null }
        );
  return { token, ownerNickname, showScores, count: nodes.length, roleCounts, nodes: visible, viewer };
}

// ── 관계 축 (guin-v2 4축 → guin-v3 5축) ───────────────────

/** 역할이 되는 네 축. 순서가 곧 동점일 때의 우선순위다 — 바꾸면 역할 선택이 흔들린다. */
export const GUIN_AXES = ["comfort", "practicalHelp", "communication", "stimulation"] as const;
export type GuinRoleAxisKey = (typeof GUIN_AXES)[number];

/**
 * 화면에 보여주는 다섯 축. 갈등 회복력(guin-v3)은 역할을 만들지 않는다 —
 * "회복형 친구"라는 라벨은 관계를 갈등 전제로 읽게 해서 역할 사전에 안 넣었다.
 */
export const GUIN_ALL_AXES = [...GUIN_AXES, "conflictRecovery"] as const;
export type GuinAxisKey = (typeof GUIN_ALL_AXES)[number];

/** guin-v2 행에는 conflictRecovery 가 없다 — 소급 계산하지 않는다. */
export type GuinAxes = Record<GuinRoleAxisKey, number> & { conflictRecovery?: number };

export const AXIS_LABEL: Record<GuinAxisKey, string> = {
  comfort: "편안함",
  practicalHelp: "현실적 도움",
  communication: "대화",
  stimulation: "새로운 자극",
  conflictRecovery: "갈등 회복력",
};

/** 이 노드의 축 점수에 실제로 들어 있는 축만 — v2/v3 행이 섞여도 화면이 안 깨진다. */
export function axisKeysOf(axes: GuinAxes | null | undefined): GuinAxisKey[] {
  if (!axes) return [];
  return GUIN_ALL_AXES.filter((key) => typeof axes[key] === "number");
}

/**
 * 점수 구간 표현 (지시문 8.6). "나쁜 궁합"·"운명" 같은 표현은 만들지 않는다 —
 * 낮은 구간도 관계의 성격이지 판정이 아니다.
 */
export function scoreBandOf(score: number): string {
  if (score >= 90) return "여러 관계 축에서 강하게 연결되는 관계";
  if (score >= 75) return "서로의 강점이 잘 이어지는 관계";
  if (score >= 60) return "맞춰가면 좋은 균형형 관계";
  return "서로 다른 방식으로 이해해야 하는 관계";
}

// ── 실제 관계 상태 (guin-v3, 지시문 8) ────────────────────
//
// 상태는 사주 축 점수를 절대 바꾸지 않는다. 같은 생년월일이면 상태가 무엇이든
// 축·역할·케미가 같다 — 상태는 AI 해석의 초점과 행동 제안에만 닿는다.

export const GUIN_STATUSES = [
  "crush",
  "dating",
  "conflict",
  "no_contact",
  "reunion",
  "friend",
  "family",
  "coworker",
  "unclear",
] as const;
export type GuinRelStatus = (typeof GUIN_STATUSES)[number];

export const STATUS_LABEL: Record<GuinRelStatus, string> = {
  crush: "썸",
  dating: "연인",
  conflict: "갈등 중",
  no_contact: "연락이 줄었어요",
  reunion: "재회 고민",
  friend: "친구",
  family: "가족",
  coworker: "동료",
  unclear: "잘 모르겠어요",
};

export function normalizeStatus(value: unknown): GuinRelStatus | null {
  return GUIN_STATUSES.includes(value as GuinRelStatus) ? (value as GuinRelStatus) : null;
}

/**
 * AI 관계 리포트 (guin-v3, 지시문 9). 서버가 계산한 축·역할을 사용자 언어로
 * 편집한 결과다 — AI 는 점수·역할·축을 만들지도 바꾸지도 않는다.
 * 생성 실패·검증 실패 시 이 값이 없고, 화면은 결정론 템플릿 카드로 폴백한다.
 */
export interface GuinAiReport {
  summary: string;
  roleExplanation: string;
  strengths: [string, string];
  caution: string;
  currentContext: string;
  suggestedAction: string;
  conversationPrompt: string;
  disclaimer: string;
}

// ── 지도 단계 (지시문 11) ─────────────────────────────────

export type GuinStage = "empty" | "one" | "two" | "three_plus";

export function getMapStage(participantCount: number): GuinStage {
  if (participantCount === 0) return "empty";
  if (participantCount === 1) return "one";
  if (participantCount === 2) return "two";
  return "three_plus";
}

// ── 공유 카피 A/B/C (지시문 12) ───────────────────────────
//
// 세 안은 다른 심리 후크다: A 호기심, B 빈칸 완성, C 감정·대화.
// 배정은 브라우저에 남고, 공유 URL 에 ?v= 로 실려 초대 랜딩이 같은 안을
// 보여준다 — 어느 카피가 데려왔는지가 이벤트(product 칸)로 남는다.

export type GuinCopyVariant = "A" | "B" | "C";

export interface GuinCopy {
  /** 카카오·Web Share 에 실리는 메시지 */
  shareText: string;
  /** 초대 랜딩의 머리 문구. {owner} 가 주인 별명으로 바뀐다. */
  inviteTitle: string;
  inviteBody: string;
  inviteCta: string;
}

export const GUIN_COPY: Record<GuinCopyVariant, GuinCopy> = {
  A: {
    shareText:
      "내 귀인 지도에 너를 초대했어.\n생일만 입력하면 우리가 어떤 인연인지 나온대.\n너는 나에게 어떤 역할일까?",
    inviteTitle: "{owner}님이 당신을 귀인 지도에 초대했어요",
    inviteBody:
      "생일을 입력하면 두 사람이 어떤 인연인지 케미와 관계 유형으로 확인할 수 있어요. 생년월일과 출생시간은 지도에 공개되지 않아요.",
    inviteCta: "내 관계 확인하기",
  },
  B: {
    shareText:
      "내 관계 지도를 만드는 중인데 아직 한 자리가 비어 있어.\n네 생일을 넣으면 우리가 어떤 인연인지 바로 나온대.\n같이 확인해볼래?",
    inviteTitle: "{owner}님의 관계 지도에 당신의 자리가 아직 비어 있어요",
    inviteBody: "생일을 입력하면 지도에 새로운 인연이 추가되고, 두 사람의 관계 카드가 열립니다.",
    inviteCta: "빈자리 채우기",
  },
  C: {
    shareText:
      "나는 너를 어떤 인연으로 보고 있을까 궁금해서\n러브레빗 관계 지도를 만들어봤어.\n네 생일을 넣으면 우리 관계를 같이 확인할 수 있대.",
    inviteTitle: "우리는 서로에게 어떤 사람일까요?",
    inviteBody:
      "생일을 입력하면 두 사람의 관계 흐름과 서로에게 주는 영향을 확인할 수 있어요. 결과는 재미와 대화를 위한 관계 리딩이며, 생년월일과 출생시간은 공개되지 않아요.",
    inviteCta: "우리 관계 확인하기",
  },
};

export function normalizeCopyVariant(value: unknown): GuinCopyVariant {
  return value === "B" || value === "C" ? value : "A";
}

/**
 * 카피 배정 — A 50% / B 25% / C 25% (지시문 12 실험 설계).
 * random 을 주입받는 건 테스트 때문이다. 기본은 Math.random.
 */
export function assignCopyVariant(random: () => number = Math.random): GuinCopyVariant {
  const roll = random();
  if (roll < 0.5) return "A";
  if (roll < 0.75) return "B";
  return "C";
}

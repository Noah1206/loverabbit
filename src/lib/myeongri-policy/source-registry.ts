// 고급 해석의 출처 등록부.
//
// 조후·격국·용신은 앞선 층들과 성격이 다르다. 만세력은 틀리면 틀린 것이 드러나지만,
// "이 사람의 용신은 화다" 는 틀려도 아무 데서도 드러나지 않는다. 학설이 갈리는 자리라
// 반증이 안 되기 때문이다. 그래서 이 층에서는 **결론보다 출처가 먼저다.**
//
// 규칙은 하나다. 사용자에게 나가는 고급 해석 문장은 반드시
//   approved 상태의 정책 규칙 -> 그 규칙이 가리키는 출처 -> 그 출처의 권리 상태
// 세 칸이 다 차 있어야 한다. 하나라도 비면 계산은 하되 말하지 않는다.
//
// rightsStatus 를 따로 두는 이유:
//   고전 원문과 현대 번역·주석은 권리가 다르다. 원문이 public domain 이어도
//   특정 판본의 번역문과 주석은 그렇지 않다. 저작권 있는 주석을 긁어와 표로 만들면
//   그건 명리 문제가 아니라 법 문제가 된다. metadata_only 는 "이 책이 이 주제를
//   다룬다는 사실까지만 안다" 는 뜻이고, 그 상태로는 결론을 승인할 수 없다.

export type SourceType =
  | "classical_text"
  | "licensed_commentary"
  | "academic_study"
  | "internal_policy";

export type RightsStatus =
  | "public_domain_verified"
  | "licensed"
  | "metadata_only"
  | "internal";

export interface MyeongriSource {
  sourceId: string;
  title: string;
  sourceType: SourceType;
  edition: string;
  translatorOrCommentator?: string;
  publicationYear?: string;
  /** 권/편/장/쪽 또는 식별 가능한 원문 위치 */
  locator: string;
  rightsStatus: RightsStatus;
  /** 권리를 확인한 발췌만 담는다. metadata_only 에는 넣지 않는다. */
  excerpt?: string;
  interpretationNote?: string;
  /** 이 출처와 결론이 갈리는 다른 출처 */
  conflictsWith?: string[];
}

export type PolicyRuleStatus =
  | "draft"
  | "source_attached"
  | "reviewed"
  | "approved"
  | "deprecated";

export type AdvancedRuleFamily = "johu" | "gyeokguk" | "yongsin" | "conflict_resolution";

export interface AdvancedPolicyRule {
  ruleId: string;
  family: AdvancedRuleFamily;
  status: PolicyRuleStatus;
  sourceIds: string[];
  /** 어떤 명식·어떤 상황에 걸리는가 (사람이 읽는 말) */
  applicability: string;
  /** 이 규칙이 서려면 계산돼 있어야 하는 값 */
  requiredFacts: string[];
  output: Record<string, unknown>;
  safePhrasing: string[];
  forbiddenPhrasing: string[];
  policyVersion: string;
  /** approved 로 올린 사람과 시각 — 승인은 흔적을 남긴다 */
  approvedBy?: string;
  approvedAt?: string;
  regressionSuiteVersion?: string;
}

export const SOURCE_POLICY_VERSION = "advanced-source-v1-2026-08";

/**
 * 등록된 출처.
 *
 * 지금은 전부 metadata_only 다. 이 저장소에 어떤 판본의 원문도 들어 있지 않고,
 * 저작권 있는 번역·주석을 긁어오지 않기로 했기 때문이다. 판본을 실제로 확보하면
 * 그 항목만 locator·excerpt 를 채우고 rightsStatus 를 올린다.
 *
 * metadata_only 로 할 수 있는 일: 관리 화면에 "이 주제의 근거 후보는 이것" 이라고
 *   적어 두는 것, 정책 규칙이 어느 책을 겨냥하는지 표시하는 것.
 * 할 수 없는 일: 그 출처를 근거로 사용자에게 결론을 내보내는 것.
 */
export const MYEONGRI_SOURCES: MyeongriSource[] = [
  {
    sourceId: "SRC-CHUNMISO-IM",
    title: "적천수천미(滴天髓闡微)",
    sourceType: "classical_text",
    edition: "임철초 증주본 (판본 미확정)",
    translatorOrCommentator: "임철초(任鐵樵) 주",
    locator: "권차·편명 미확정 — 판본 확보 후 기재",
    rightsStatus: "metadata_only",
    interpretationNote:
      "억부를 중심에 두면서도 조후·격국을 함께 쓰는 다축 적용의 근거 후보. " +
      "이 책 하나로 용신법이 결정되지 않는다는 것이 오히려 이 층의 설계 근거다.",
    conflictsWith: ["SRC-JAPYEONG"],
  },
  {
    sourceId: "SRC-GUNGTONG",
    title: "궁통보감(窮通寶鑑) / 난강망(欄江網)",
    sourceType: "classical_text",
    edition: "판본 미확정",
    locator: "일간별 월령 편 — 판본 확보 후 기재",
    rightsStatus: "metadata_only",
    interpretationNote:
      "월령의 한난조습과 조후용신의 출처 후보. 일간 10 × 월지 12 = 120칸 표가 " +
      "여기서 나온다. 표를 채우려면 이 항목이 먼저 licensed 또는 " +
      "public_domain_verified 로 올라가야 한다.",
    conflictsWith: ["SRC-CHUNMISO-IM"],
  },
  {
    sourceId: "SRC-JAPYEONG",
    title: "자평진전(子平眞詮)",
    sourceType: "classical_text",
    edition: "판본 미확정",
    translatorOrCommentator: "심효첨(沈孝瞻)",
    locator: "논용신·논격국 편 — 판본 확보 후 기재",
    rightsStatus: "metadata_only",
    interpretationNote:
      "격국의 순용(順用)·역용(逆用)과 상신(相神)의 출처 후보. 월령을 격의 중심에 두는 쪽.",
    conflictsWith: ["SRC-CHUNMISO-IM"],
  },
  {
    sourceId: "SRC-YEONHAE",
    title: "연해자평(淵海子平)",
    sourceType: "classical_text",
    edition: "판본 미확정",
    locator: "판본 확보 후 기재",
    rightsStatus: "metadata_only",
    interpretationNote: "자평 명리 구조 일반의 출처 후보. 격국 명칭 계보의 뿌리.",
  },
  {
    sourceId: "SRC-ACADEMIC-2025-YONGSHIN",
    title: "적천수천미 명조에 나타난 임철초 용신법의 적용 방식과 구조적 특성",
    sourceType: "academic_study",
    edition: "학술지 논문",
    locator: "DBpia NODE12434505",
    rightsStatus: "metadata_only",
    interpretationNote:
      "명조 512개 분석: 억부 단독 38.3%, 격국 20.3%, 조후 8.4%, 나머지는 둘 이상 병용. " +
      "**용신을 하나로 자동 단정하지 않는다**는 이 층의 기본 설계가 여기서 나왔다. " +
      "수치는 설계 근거로 쓰고, 사용자 결론의 근거로는 쓰지 않는다.",
  },
  {
    sourceId: "SRC-ACADEMIC-2019-JOHU",
    title: "궁통보감의 조후용신론 고찰",
    sourceType: "academic_study",
    edition: "학술지 논문",
    locator: "교보 스콜라 4010070036438",
    rightsStatus: "metadata_only",
    interpretationNote: "억부·격국·조후를 함께 적용할 필요성을 제안. 축 병용 설계의 근거.",
  },
  {
    sourceId: "SRC-ACADEMIC-2013-WOLJI",
    title: "명리학에서 월지중심의 간명법과 격국운용에 관한 연구",
    sourceType: "academic_study",
    edition: "학위논문",
    locator: "DBpia T13224377",
    rightsStatus: "metadata_only",
    interpretationNote:
      "월지를 격국의 핵심으로 보는 전통과, 용신 선택에 주관이 개입한다는 비판이 함께 있다. " +
      "격국 V1을 월지 중심 내격으로 좁힌 근거.",
  },
  {
    sourceId: "SRC-INTERNAL-CLIMATE",
    title: "내부 정책 — 절기·월지 기반 한난조습 계산",
    sourceType: "internal_policy",
    edition: SOURCE_POLICY_VERSION,
    locator: "src/lib/myeongri/seasonal-context.ts",
    rightsStatus: "internal",
    interpretationNote:
      "이것만은 결론이 아니라 계산이다. 축월이 겨울이라는 것, 입춘이 언제인지, " +
      "진·축이 습토이고 술·미가 조토라는 것은 학설이 갈리는 자리가 아니다. " +
      "그래서 이 출처만 내부 정책으로 서고, 조후'용신'은 여기에 기대지 않는다.",
  },
];

const BY_ID = new Map(MYEONGRI_SOURCES.map((s) => [s.sourceId, s]));

export function sourceOf(sourceId: string): MyeongriSource | null {
  return BY_ID.get(sourceId) ?? null;
}

/**
 * 이 출처로 사용자에게 나가는 결론을 만들 수 있는가.
 *
 * metadata_only 는 안 된다 — 우리가 아는 것이 "그 책이 이 주제를 다룬다"까지이기
 * 때문이다. 그 상태에서 표를 채우면 채운 사람이 지어낸 것이 출처를 얻은 것처럼 보인다.
 */
export function canBackUserFacingClaim(sourceId: string): boolean {
  const source = BY_ID.get(sourceId);
  if (!source) return false;
  return source.rightsStatus === "public_domain_verified" || source.rightsStatus === "licensed";
}

/** 규칙이 사용자에게 나갈 수 있는가 — 상태와 출처를 함께 본다 */
export function ruleIsUserFacing(rule: AdvancedPolicyRule): boolean {
  if (rule.status !== "approved") return false;
  if (rule.sourceIds.length === 0) return false;
  return rule.sourceIds.every(canBackUserFacingClaim);
}

/** 승인을 막고 있는 것 — 관리 화면이 그대로 보여 준다 */
export function blockersFor(rule: AdvancedPolicyRule): string[] {
  const out: string[] = [];
  if (rule.sourceIds.length === 0) out.push("출처가 붙어 있지 않다");
  for (const id of rule.sourceIds) {
    const source = BY_ID.get(id);
    if (!source) {
      out.push(`${id} — 등록되지 않은 출처다`);
      continue;
    }
    if (!canBackUserFacingClaim(id)) {
      out.push(`${source.title} — ${source.rightsStatus} 상태라 결론의 근거가 될 수 없다`);
    }
    if (source.locator.includes("미확정")) {
      out.push(`${source.title} — 판본과 위치가 확정되지 않았다`);
    }
  }
  if (rule.status !== "approved") out.push(`규칙 상태가 ${rule.status} 다`);
  if (rule.status === "approved" && !rule.approvedBy) out.push("승인자가 기록되지 않았다");
  return out;
}

/** 상태 전이 — 건너뛸 수 없다 */
const TRANSITIONS: Record<PolicyRuleStatus, PolicyRuleStatus[]> = {
  draft: ["source_attached"],
  source_attached: ["reviewed", "draft"],
  reviewed: ["approved", "source_attached"],
  approved: ["deprecated"],
  deprecated: [],
};

export function canTransition(from: PolicyRuleStatus, to: PolicyRuleStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

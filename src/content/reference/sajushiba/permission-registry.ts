// 원문 재사용 허가 레지스트리.
//
// 어느 게시물을 어디까지 쓸 수 있는지를 여기 한 곳에 적는다.
// 코드 곳곳에서 "이건 써도 되나"를 판단하면 판단이 갈라지고, 갈라진 판단 중
// 하나는 반드시 느슨한 쪽이다.
//
// 허가의 근거는 코드가 아니라 사람이 채운다. permissionEvidencePath / approvedBy /
// approvedAt 이 비어 있으면 verbatim_* 는 열리지 않는다 — 환경변수를 켜도 열리지
// 않는다. 이 상태는 실패가 아니라 needs_permission_metadata 이고, 운영자가
// PERMISSION.md 세 줄을 채우면 그대로 열린다.

export type AuthorizedReuseMode =
  | "pattern_only"
  | "close_adaptation"
  | "verbatim_excerpt"
  | "verbatim_full_post";

export type AuthorizedSourcePermission = {
  sourcePostId: string;
  allowed: boolean;
  allowedModes: AuthorizedReuseMode[];
  permissionEvidencePath: string;
  approvedBy: string;
  approvedAt: string;
  notes?: string;
};

/**
 * 허가 증빙 — 운영자가 채운다.
 *
 * 세 값이 전부 채워져야 verbatim_* 가 열린다. 지금은 비어 있고, 비어 있는 것이
 * 맞다. PERMISSION.md 를 채운 다음 이 상수를 같은 값으로 맞춰라.
 * 두 곳에 적는 이유는, 코드만 고치고 기록을 안 남기는 일과 기록만 남기고 코드를
 * 안 고치는 일을 둘 다 막기 위해서다.
 */
export const PERMISSION_EVIDENCE = {
  permissionEvidencePath: "",
  approvedBy: "",
  approvedAt: "",
} as const;

/**
 * 게시물별 허용 범위.
 *
 * allowedModes 는 "운영자가 이 글을 어디까지 쓸 생각인가"이고,
 * 실제로 열리는지는 evidence 와 원문의 상태가 함께 정한다.
 *
 * pattern_only 와 close_adaptation 은 증빙 없이도 쓴다. 그 둘은 원문 문장을
 * 옮기지 않기 때문이다 — 구조와 리듬은 pattern-library.v1.json 이 이미 일반화해
 * 둔 층이다. 문장을 그대로 가져가는 것만 증빙을 요구한다.
 */
export const PERMISSION_REGISTRY: AuthorizedSourcePermission[] = [
  {
    sourcePostId: "SS-20260703-WEEKLY-TOP5",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation"],
    ...PERMISSION_EVIDENCE,
    notes: "주간 띠 순위. 순위·점수가 본문의 뼈대라 승인 산식 없이는 close_adaptation 도 대상 치환이 안 된다.",
  },
  {
    sourcePostId: "SS-20260716-FREE-READING",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation", "verbatim_excerpt"],
    ...PERMISSION_EVIDENCE,
    notes: "무료 리딩 게이트. 사주시바 브랜드·링크·모집 조건이 본문에 섞여 있어 발췌 구간을 골라야 한다.",
  },
  {
    sourcePostId: "SS-20260722-DAILY-12-ZODIAC",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation"],
    ...PERMISSION_EVIDENCE,
    notes: "12띠 순위판. 점수·색·방향 승인 테이블이 없다.",
  },
  {
    sourcePostId: "SS-20260722-COLOR-WARNING",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation"],
    ...PERMISSION_EVIDENCE,
    notes: "띠별 색 경고. 색 대응표가 없다.",
  },
  {
    sourcePostId: "SS-20260725-APP-LAUNCH",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation"],
    ...PERMISSION_EVIDENCE,
    notes: "앱 출시·테스터 모집. 러브레빗의 실제 사실로 바꾸지 않으면 쓸 수 없다.",
  },
  {
    sourcePostId: "SS-20260730-DAILY-RANKING",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation", "verbatim_excerpt"],
    ...PERMISSION_EVIDENCE,
    notes: "일일 순위. 순위·간지 구간을 뺀 해설 문장만 발췌 대상이다.",
  },
  {
    sourcePostId: "SS-20260731-WEEKLY-LOVE-TOP5",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation"],
    ...PERMISSION_EVIDENCE,
    notes: "주간 일주 연애운 TOP5. 순위가 뼈대다.",
  },
  {
    sourcePostId: "SS-20260731-WEEKLY-LOVE-REPLIES",
    allowed: true,
    allowedModes: ["pattern_only"],
    ...PERMISSION_EVIDENCE,
    notes: "부모 글이 없어 문맥이 잘려 있다. 문장을 옮기면 앞뒤가 없는 말이 된다.",
  },
  {
    sourcePostId: "SS-20260802-GOAT-INNER-WORLD",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation", "verbatim_excerpt"],
    ...PERMISSION_EVIDENCE,
    notes: "양띠 속마음. 시의성이 없어 발췌가 오래 간다.",
  },
  {
    sourcePostId: "SS-20260805-HIDDEN-PAIN",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation", "verbatim_excerpt", "verbatim_full_post"],
    ...PERMISSION_EVIDENCE,
    notes: "겉과 속. 브랜드·링크·시의성이 전부 없어 전문 재사용까지 후보가 되는 둘 중 하나.",
  },
  {
    sourcePostId: "SS-20260807-HIDDEN-MIND",
    allowed: true,
    allowedModes: ["pattern_only", "close_adaptation", "verbatim_excerpt", "verbatim_full_post"],
    ...PERMISSION_EVIDENCE,
    notes: "12띠 속마음. 브랜드·링크·시의성 없음.",
  },
];

export type ReuseDecision =
  | { ok: true; mode: AuthorizedReuseMode }
  | {
      ok: false;
      status:
        | "unknown_source"
        | "not_allowed"
        | "mode_not_allowed"
        | "needs_permission_metadata"
        | "context_truncated";
      reason: string;
    };

export function permissionFor(sourcePostId: string): AuthorizedSourcePermission | null {
  return PERMISSION_REGISTRY.find((p) => p.sourcePostId === sourcePostId) ?? null;
}

/** 증빙 세 줄이 다 채워졌는가 */
export function hasEvidence(permission: AuthorizedSourcePermission): boolean {
  return Boolean(
    permission.permissionEvidencePath.trim() &&
      permission.approvedBy.trim() &&
      permission.approvedAt.trim()
  );
}

export function isVerbatim(mode: AuthorizedReuseMode): boolean {
  return mode === "verbatim_excerpt" || mode === "verbatim_full_post";
}

/**
 * 이 게시물을 이 모드로 써도 되는가.
 *
 * 막는 이유를 상태로 나눈다. "안 된다"만 돌려주면 운영자가 무엇을 고쳐야
 * 열리는지 알 수 없고, 그러면 결국 코드를 고쳐서 연다.
 */
export function reuseDecision(
  sourcePostId: string,
  mode: AuthorizedReuseMode,
  options: { extractionStatus?: "complete" | "partial_parent_unavailable" } = {}
): ReuseDecision {
  const permission = permissionFor(sourcePostId);
  if (!permission) {
    return {
      ok: false,
      status: "unknown_source",
      reason: `레지스트리에 없는 게시물 — ${sourcePostId}. 허가는 corpus.v1.jsonl 안에만 걸려 있다`,
    };
  }
  if (!permission.allowed) {
    return { ok: false, status: "not_allowed", reason: `${sourcePostId} 는 사용 불가로 표시돼 있다` };
  }
  if (!permission.allowedModes.includes(mode)) {
    return {
      ok: false,
      status: "mode_not_allowed",
      reason: `${sourcePostId} 는 ${mode} 를 허용하지 않는다 (허용: ${permission.allowedModes.join(", ")})`,
    };
  }
  if (isVerbatim(mode)) {
    if (options.extractionStatus === "partial_parent_unavailable") {
      return {
        ok: false,
        status: "context_truncated",
        reason: `${sourcePostId} 는 부모 글이 없어 문맥이 잘려 있다 — 문장을 옮기면 앞뒤가 없는 말이 된다`,
      };
    }
    if (!hasEvidence(permission)) {
      return {
        ok: false,
        status: "needs_permission_metadata",
        reason:
          `${sourcePostId} — permissionEvidencePath / approvedBy / approvedAt 이 비어 있다. ` +
          "PERMISSION.md 와 permission-registry.ts 의 PERMISSION_EVIDENCE 를 채우면 열린다",
      };
    }
  }
  return { ok: true, mode };
}

/** 레지스트리 전체 상태 — 보고와 화면이 같은 값을 본다 */
export function registryReport() {
  const total = PERMISSION_REGISTRY.length;
  const withEvidence = PERMISSION_REGISTRY.filter(hasEvidence).length;
  const verbatimCandidates = PERMISSION_REGISTRY.filter((p) =>
    p.allowedModes.some(isVerbatim)
  ).map((p) => p.sourcePostId);
  return {
    total,
    withEvidence,
    needsMetadata: total - withEvidence,
    verbatimCandidates,
    evidenceReady: withEvidence === total,
  };
}

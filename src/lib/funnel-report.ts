// 발자국을 사람 수로 바꾼다.
//
// 세는 단위는 사건이 아니라 **세션**이다. 한 사람이 칸을 앞뒤로 오가면 사건은
// 여럿이지만 사람은 하나다. 사건으로 세면 망설인 사람이 여러 명으로 보이고,
// 그러면 망설임이 인기로 읽힌다.

import { FUNNEL_ORDER, READING_STEPS, type FunnelEventName } from "@/lib/funnel-events";
import { decodeOnce } from "@/lib/attribution";

export interface FunnelEventRow {
  session_id: string;
  user_id: number | null;
  name: string;
  step: string | null;
  path: string | null;
  product: string | null;
  dwell_ms: number | null;
  seq: number;
  created_at: string;
  attribution?: { source?: string; campaign?: string; content?: string; fbclid?: string } | null;
}

export interface SourceRow {
  source: string;
  campaign: string;
  content: string;
  sessions: number;
  /** 그중 리딩 폼까지 들어온 세션 */
  reachedForm: number;
}

export interface StageRow {
  name: string;
  label: string;
  sessions: number;
  /** 여기까지 왔지만 다음 줄로 못 간 사람 */
  dropped: number;
  /** 앞 줄 대비 통과율 (%) */
  passRate: number | null;
}

export interface FormStepRow {
  step: string;
  label: string;
  /** 이 칸을 본 세션 */
  reached: number;
  /** 이 칸을 마지막으로 보고 폼을 끝내지 못한 세션 */
  abandoned: number;
}

export interface PageRow {
  path: string;
  views: number;
  /** 이 화면이 세션의 마지막이었던 횟수 = 여기서 나갔다 */
  exits: number;
  medianDwellMs: number | null;
}

export interface SessionTrail {
  sessionId: string;
  userId: number | null;
  startedAt: string;
  endedAt: string;
  /** 마지막으로 닿은 퍼널 단계 */
  reached: string;
  /** 마지막 화면 */
  lastPath: string | null;
  events: number;
}

export interface FunnelReport {
  sessions: number;
  events: number;
  /**
   * Meta 인앱 브라우저의 사전 로딩으로 보이는 방문. 광고가 화면에 뜨면 랜딩을 미리
   * 열었다가 30초쯤 뒤 버린다 - 발자국이 열람·이탈 둘뿐이고 체류가 28~34초에 몰리며
   * fbclid 가 달려 있다. 사람이 이렇게 균일하게 나가지 않는다. 세지 않고 따로 알린다.
   */
  ghosts: number;
  sources: SourceRow[];
  /** 상한에 걸려 잘렸는가. 잘렸다면 숫자는 최근 것만 본 결과다 */
  truncated: boolean;
  stages: StageRow[];
  formSteps: FormStepRow[];
  pages: PageRow[];
  trails: SessionTrail[];
}

export const READING_STEP_LABELS: Record<string, string> = {
  category: "리딩 선택",
  mode: "함께 볼 사람",
  meGender: "성별",
  meBirth: "내 생년월일",
  meDetails: "내 출생 정보",
  partnerBirth: "그 사람 생년월일",
  partnerDetails: "그 사람 출생 정보",
  concern: "지금의 고민",
  ready: "마지막 확인",
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/**
 * 세션 하나의 발자국을 순서대로 모은다.
 *
 * seq 로 세운다 — created_at 은 묶어 보낸 것들이 같은 밀리초에 앉아 앞뒤가
 * 뒤집힌다. seq 는 브라우저가 하나씩 올린 값이라 그 안에서는 틀리지 않는다.
 */
function groupBySession(rows: FunnelEventRow[]): Map<string, FunnelEventRow[]> {
  const map = new Map<string, FunnelEventRow[]>();
  for (const row of rows) {
    const list = map.get(row.session_id);
    if (list) list.push(row);
    else map.set(row.session_id, [row]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.seq === b.seq ? a.created_at.localeCompare(b.created_at) : a.seq - b.seq));
  }
  return map;
}

/** Meta 사전 로딩으로 보이는 세션인가 */
export function looksLikePrefetch(list: FunnelEventRow[]): boolean {
  if (list.length !== 2) return false;
  const [a, b] = list;
  if (a.name !== "page_view" || b.name !== "page_exit") return false;
  const fbclid = Boolean(a.attribution?.fbclid || b.attribution?.fbclid);
  if (!fbclid) return false;
  const dwell = b.dwell_ms ?? 0;
  return dwell >= 25_000 && dwell <= 40_000;
}

export function buildFunnelReport(rows: FunnelEventRow[], truncated = false): FunnelReport {
  const grouped = groupBySession(rows);
  // 유령은 걷어내고 수만 남긴다. 섞어 두면 방문이 40% 부풀고 랜딩 이탈률이 거짓말을 한다.
  let ghosts = 0;
  const sessions = new Map<string, FunnelEventRow[]>();
  for (const [id, list] of grouped) {
    if (looksLikePrefetch(list)) ghosts += 1;
    else sessions.set(id, list);
  }

  // ── 유입 ──
  const sourceMap = new Map<string, SourceRow>();
  for (const list of sessions.values()) {
    const attr = list.find((row) => row.attribution)?.attribution ?? null;
    const source = decodeOnce(attr?.source ?? "") || "직접·기타";
    const campaign = decodeOnce(attr?.campaign ?? "") || "-";
    const content = decodeOnce(attr?.content ?? "") || "-";
    const key = `${source}|${campaign}|${content}`;
    const row = sourceMap.get(key) ?? { source, campaign, content, sessions: 0, reachedForm: 0 };
    row.sessions += 1;
    if (list.some((e) => e.name === "step_view")) row.reachedForm += 1;
    sourceMap.set(key, row);
  }
  const sources = [...sourceMap.values()].sort((a, b) => b.sessions - a.sessions);

  // ── 단계별 ────────────────────────────────────────────────────────────
  const reachedBy = new Map<FunnelEventName, Set<string>>();
  for (const { name } of FUNNEL_ORDER) reachedBy.set(name, new Set());
  for (const [sessionId, list] of sessions) {
    for (const row of list) {
      const bucket = reachedBy.get(row.name as FunnelEventName);
      if (bucket) bucket.add(sessionId);
    }
  }
  const stages: StageRow[] = FUNNEL_ORDER.map(({ name, label }, index) => {
    const here = reachedBy.get(name)?.size ?? 0;
    const next = index + 1 < FUNNEL_ORDER.length
      ? (reachedBy.get(FUNNEL_ORDER[index + 1].name)?.size ?? 0)
      : null;
    const previous = index > 0 ? (reachedBy.get(FUNNEL_ORDER[index - 1].name)?.size ?? 0) : null;
    return {
      name,
      label,
      sessions: here,
      // 다음 줄로 간 사람이 더 많을 수는 없지만, 세션이 중간에 끊겨 앞 단계가
      // 비는 경우가 실제로 생긴다. 음수로 내려가지 않게 잡는다.
      dropped: next === null ? 0 : Math.max(0, here - next),
      passRate: previous && previous > 0 ? Math.round((here / previous) * 1000) / 10 : null,
    };
  });

  // ── 폼 칸별 ───────────────────────────────────────────────────────────
  const stepReached = new Map<string, Set<string>>();
  const stepAbandoned = new Map<string, number>();
  for (const step of READING_STEPS) {
    stepReached.set(step, new Set());
    stepAbandoned.set(step, 0);
  }
  for (const [sessionId, list] of sessions) {
    let lastStep: string | null = null;
    let submitted = false;
    for (const row of list) {
      if (row.name === "step_view" && row.step) {
        stepReached.get(row.step)?.add(sessionId);
        lastStep = row.step;
      }
      if (row.name === "preview_requested") submitted = true;
    }
    // 폼을 끝내지 못한 세션의 마지막 칸 = 손을 놓은 자리.
    if (lastStep && !submitted) {
      stepAbandoned.set(lastStep, (stepAbandoned.get(lastStep) ?? 0) + 1);
    }
  }
  const formSteps: FormStepRow[] = READING_STEPS.map((step) => ({
    step,
    label: READING_STEP_LABELS[step] ?? step,
    reached: stepReached.get(step)?.size ?? 0,
    abandoned: stepAbandoned.get(step) ?? 0,
  })).filter((row) => row.reached > 0);

  // ── 화면별 ────────────────────────────────────────────────────────────
  const pageViews = new Map<string, number>();
  const pageExits = new Map<string, number>();
  const pageDwell = new Map<string, number[]>();
  for (const list of sessions.values()) {
    for (const row of list) {
      if (row.name === "page_view" && row.path) {
        pageViews.set(row.path, (pageViews.get(row.path) ?? 0) + 1);
      }
      if (row.name === "page_exit" && row.path && row.dwell_ms !== null) {
        const bucket = pageDwell.get(row.path);
        if (bucket) bucket.push(row.dwell_ms);
        else pageDwell.set(row.path, [row.dwell_ms]);
      }
    }
    // 세션의 마지막 화면이 이탈 지점이다. page_exit 이 있으면 그 경로,
    // 없으면(브라우저가 이탈 신호를 못 보낸 경우) 마지막으로 연 화면.
    const lastWithPath = [...list].reverse().find((row) => row.path);
    if (lastWithPath?.path) {
      pageExits.set(lastWithPath.path, (pageExits.get(lastWithPath.path) ?? 0) + 1);
    }
  }
  const pages: PageRow[] = [...new Set([...pageViews.keys(), ...pageExits.keys()])]
    .map((path) => ({
      path,
      views: pageViews.get(path) ?? 0,
      exits: pageExits.get(path) ?? 0,
      medianDwellMs: median(pageDwell.get(path) ?? []),
    }))
    .sort((a, b) => b.exits - a.exits || b.views - a.views);

  // ── 최근 발자국 ───────────────────────────────────────────────────────
  const stageRank = new Map<string, number>(FUNNEL_ORDER.map(({ name }, i) => [name, i]));
  const trails: SessionTrail[] = [...sessions.entries()]
    .map(([sessionId, list]) => {
      let best = -1;
      for (const row of list) {
        const rank = stageRank.get(row.name);
        if (rank !== undefined && rank > best) best = rank;
      }
      const lastWithPath = [...list].reverse().find((row) => row.path);
      return {
        sessionId,
        userId: list.find((row) => row.user_id !== null)?.user_id ?? null,
        startedAt: list[0].created_at,
        endedAt: list[list.length - 1].created_at,
        reached: best >= 0 ? FUNNEL_ORDER[best].label : "둘러보기만",
        lastPath: lastWithPath?.path ?? null,
        events: list.length,
      };
    })
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));

  return {
    sessions: sessions.size,
    events: rows.length,
    truncated,
    ghosts,
    sources,
    stages,
    formSteps,
    pages,
    trails,
  };
}

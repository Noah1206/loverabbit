import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeAttribution } from "@/lib/attribution";
import { isFunnelEvent, isReadingStep, normalizePath } from "@/lib/funnel-events";
import { resolveUserToken } from "@/lib/tokens";

// 발자국을 받는다.
//
// **여기 오는 값은 전부 남이 지어낼 수 있다.** 로그인도 없고 누구나 부를 수 있는
// 자리다. 그래서 허용 목록으로 거른다 — 이름도, 단계도, 경로도. 모르는 것은
// 고치지 않고 버린다. 자유 문자열을 한 칸이라도 열어두면 이 표가 곧 남의 게시판이
// 되고, 관리자 화면이 그걸 그린다.
//
// 실패해도 204 로 답한다. 브라우저는 이 응답으로 할 일이 없고, 오류를 돌려주면
// 콘솔만 시끄러워진다. 못 적은 발자국은 그냥 없는 것으로 둔다.

/** 한 번에 받는 최대 개수. 넘치면 앞을 자른다. */
const MAX_EVENTS = 40;

interface IncomingEvent {
  name?: unknown;
  step?: unknown;
  path?: unknown;
  product?: unknown;
  landing?: unknown;
  dwellMs?: unknown;
  seq?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 상품·랜딩 이름표. 주소나 본문에서 온 값이라 모양만 통과시킨다. */
function label(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  return clean || null;
}

function count(value: unknown, cap = 100_000): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), cap);
}

// 체류 시간은 10분까지 남긴다. 100초에서 자르니 결제한 사람 29명 중 20명이
// 전부 "100초"로 찍혀 끝까지 읽었는지 알 수 없었다 (2026-08-28).
const DWELL_CAP_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ok = new NextResponse(null, { status: 204 });
  try {
    // 크롤러의 발자국은 사람의 이탈이 아니다. 섞이면 이탈률이 통째로 거짓말이 된다.
    const agent = request.headers.get("user-agent") ?? "";
    if (/bot|crawler|spider|crawling|headless|preview|monitor|curl|wget/i.test(agent)) return ok;

    const body = (await request.json().catch(() => null)) as
      | { sessionId?: unknown; userToken?: unknown; attribution?: unknown; events?: unknown }
      | null;
    if (!body) return ok;

    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!UUID.test(sessionId)) return ok;

    const raw = Array.isArray(body.events) ? (body.events as IncomingEvent[]) : [];
    if (raw.length === 0) return ok;

    const db = getSupabaseAdmin();
    if (!db) return ok;

    // 로그인한 사람의 발자국이면 계정에 묶는다. 토큰이 낡았거나 없으면 그냥 익명으로
    // 남는다 — 여기서 막을 이유가 없다.
    let userId: number | null = null;
    try {
      const user = await resolveUserToken(
        typeof body.userToken === "string" ? body.userToken : undefined
      );
      userId = user?.userId ?? null;
    } catch {
      userId = null;
    }

    const attribution = normalizeAttribution(body.attribution);
    const rows = raw
      .slice(0, MAX_EVENTS)
      .filter((event) => isFunnelEvent(event.name))
      // 칸 이름 없는 step_view 는 버린다. 폼 퍼널에서 쓸 데가 없으면서 "폼에
      // 들어온 사람" 수만 올려, 있지도 않은 진입을 만들어낸다.
      .filter((event) => event.name !== "step_view" || isReadingStep(event.step))
      .map((event) => ({
        session_id: sessionId,
        user_id: userId,
        name: event.name as string,
        // 단계는 목록에 있는 것만. 없는 이름은 비워 둔다 — 지어낸 칸이 퍼널에
        // 끼면 통과율이 뒤틀린다.
        step: isReadingStep(event.step) ? (event.step as string) : null,
        path: normalizePath(event.path),
        product: label(event.product),
        landing: label(event.landing),
        dwell_ms: event.dwellMs === undefined ? null : count(event.dwellMs, DWELL_CAP_MS),
        seq: count(event.seq),
        attribution,
      }));
    if (rows.length === 0) return ok;

    const { error } = await db.from("lr_funnel_events").insert(rows);
    if (error) console.error("퍼널 기록 실패:", error.message);
    return ok;
  } catch (error) {
    console.error("퍼널 기록 실패:", error);
    return ok;
  }
}

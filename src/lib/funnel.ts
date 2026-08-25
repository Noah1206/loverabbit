"use client";

// 발자국을 모아 서버로 보낸다.
//
// 규칙 셋. 이 셋이 지켜지지 않으면 붙이지 않는 게 낫다.
//
// 1. **화면을 절대 막지 않는다.** 저장소가 막혀 있든 요청이 실패하든 조용히
//    삼킨다. 통계를 못 적었다고 리딩을 못 보는 일은 없어야 한다.
// 2. **떠나는 순간을 놓치지 않는다.** 이탈 지점을 알자고 만든 것이라 마지막
//    사건이 가장 중요하다. 그런데 그 사건은 탭이 닫히는 중에 난다 — 보통의
//    fetch 는 거기서 취소된다. sendBeacon 으로 넘긴다.
// 3. **개인정보를 싣지 않는다.** 단계의 이름은 보내고 단계에 적은 값은 보내지
//    않는다. 이 파일이 만들 수 있는 항목은 아래 타입이 전부다.

import { isFunnelEvent, normalizePath, type FunnelEventName } from "@/lib/funnel-events";
import { readAttribution } from "@/lib/attribution";

const SID_KEY = "lr-fn-sid";
const SEQ_KEY = "lr-fn-seq";
const ENDPOINT = "/api/events";

/** 한 번에 보내는 최대 개수. 이보다 쌓이면 앞엣것부터 버린다. */
const MAX_QUEUE = 40;
/** 모았다 보내는 간격. 칸을 빠르게 넘기는 사람의 요청이 뭉치게 한다. */
const FLUSH_MS = 900;

export interface FunnelProps {
  step?: string;
  path?: string;
  product?: string;
  landing?: string;
  dwellMs?: number;
}

interface QueuedEvent extends FunnelProps {
  name: FunnelEventName;
  seq: number;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // 시크릿 모드·저장소 차단. 세션을 못 만들면 아무것도 보내지 않는다 —
    // 세션 없는 사건은 줄을 세울 수 없어 이탈 지점을 못 만든다.
    return null;
  }
}

/**
 * 이 탭의 방문 식별자.
 *
 * sessionStorage 다 — 탭을 닫으면 사라진다. 기기를 가로질러 사람을 따라다니는
 * 식별자가 아니고, 그래서 광고 쿠키가 아니라 접속 기록이다.
 */
function sessionId(): string | null {
  const s = store();
  if (!s) return null;
  try {
    const found = s.getItem(SID_KEY);
    if (found) return found;
    const made =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : null;
    if (!made) return null;
    s.setItem(SID_KEY, made);
    return made;
  } catch {
    return null;
  }
}

function nextSeq(): number {
  const s = store();
  if (!s) return 0;
  try {
    const now = Number(s.getItem(SEQ_KEY) ?? 0) + 1;
    s.setItem(SEQ_KEY, String(now));
    return Number.isFinite(now) ? now : 0;
  } catch {
    return 0;
  }
}

function userToken(): string | undefined {
  try {
    const raw = localStorage.getItem("loverabbit_user_v1");
    const parsed = raw ? (JSON.parse(raw) as { token?: unknown }) : null;
    return typeof parsed?.token === "string" ? parsed.token : undefined;
  } catch {
    return undefined;
  }
}

function payload(events: QueuedEvent[], sid: string): string {
  return JSON.stringify({
    sessionId: sid,
    userToken: userToken(),
    attribution: readAttribution(),
    events,
  });
}

/**
 * 쌓인 것을 보낸다.
 *
 * beacon=true 는 탭이 닫히는 중이라는 뜻이다. 그때는 응답을 기다릴 수 없으므로
 * sendBeacon 에 맡긴다 — 브라우저가 페이지가 죽은 뒤에도 마저 보내준다.
 */
export function flushFunnel(beacon = false): void {
  if (queue.length === 0) return;
  const sid = sessionId();
  if (!sid) {
    queue = [];
    return;
  }
  const batch = queue;
  queue = [];
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const body = payload(batch, sid);
  try {
    if (beacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 보내지 못한 발자국은 버린다. 다시 시도하다 화면을 붙잡는 것보다 낫다.
  }
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  // pagehide 는 탭 닫기·뒤로가기·앱 전환을 모두 덮는다. visibilitychange 는
  // 모바일에서 pagehide 없이 죽는 경우를 받아낸다. 둘 다 건다 — 한쪽만 걸면
  // 정작 이탈하는 순간을 놓치는 브라우저가 생긴다.
  window.addEventListener("pagehide", () => flushFunnel(true));
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushFunnel(true);
  });
}

/** 발자국 하나. 실패는 전부 여기서 끝난다 — 호출부는 결과를 볼 수 없다. */
export function trackFunnel(name: FunnelEventName, props: FunnelProps = {}): void {
  try {
    if (typeof window === "undefined" || !isFunnelEvent(name)) return;
    if (!sessionId()) return;
    listen();

    const event: QueuedEvent = { name, seq: nextSeq() };
    if (props.step) event.step = props.step;
    if (props.product) event.product = String(props.product).slice(0, 60);
    if (props.landing) event.landing = String(props.landing).slice(0, 60);
    if (typeof props.dwellMs === "number" && Number.isFinite(props.dwellMs)) {
      event.dwellMs = Math.max(0, Math.min(Math.round(props.dwellMs), 6 * 60 * 60 * 1000));
    }
    const path = normalizePath(props.path ?? window.location.pathname);
    if (path) event.path = path;

    queue.push(event);
    // 넘치면 앞엣것을 버린다. 최근 것이 이탈 지점에 가깝다.
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);

    // 떠나는 사건은 모아둘 시간이 없다. 곧바로 보낸다.
    if (name === "page_exit") {
      flushFunnel(true);
      return;
    }
    if (!timer) timer = setTimeout(() => flushFunnel(false), FLUSH_MS);
  } catch {
    // 통계가 화면을 막지 않는다.
  }
}

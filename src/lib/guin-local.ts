"use client";

// 귀인 지도 — 브라우저에 남는 것들.
//
// 소유 키·참여 키의 원문은 여기만 산다. 서버는 sha256 만 안다 (guin-token.ts).
// 저장소가 막힌 브라우저(시크릿 등)에서는 조용히 비어 있는 값으로 동작한다 —
// 지도는 보이고, 관리 권한만 없는 상태가 된다.

export interface MyGuinMap {
  token: string;
  ownerKey: string;
  nickname: string;
  createdAt: number;
}

const MINE_KEY = "lr_guin_mine";
const MINE_MAX = 5;

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 치명적이지 않다 — 이 기기에서 관리만 못 하게 될 뿐이다.
  }
}

export function myGuinMaps(): MyGuinMap[] {
  const list = read<MyGuinMap[]>(MINE_KEY);
  return Array.isArray(list) ? list.filter((m) => m?.token && m?.ownerKey) : [];
}

export function rememberMyGuinMap(map: MyGuinMap): void {
  const rest = myGuinMaps().filter((m) => m.token !== map.token);
  write(MINE_KEY, [map, ...rest].slice(0, MINE_MAX));
}

export function forgetMyGuinMap(token: string): void {
  write(MINE_KEY, myGuinMaps().filter((m) => m.token !== token));
}

export function ownerKeyOf(token: string): string | null {
  return myGuinMaps().find((m) => m.token === token)?.ownerKey ?? null;
}

export interface JoinedGuinMap {
  participantKey: string;
  participantId: string;
  nickname: string;
}

export function joinedGuinMap(token: string): JoinedGuinMap | null {
  const joined = read<JoinedGuinMap>(`lr_guin_joined:${token}`);
  return joined?.participantKey && joined?.participantId ? joined : null;
}

export function rememberJoinedGuinMap(token: string, joined: JoinedGuinMap): void {
  write(`lr_guin_joined:${token}`, joined);
}

export function forgetJoinedGuinMap(token: string): void {
  try {
    localStorage.removeItem(`lr_guin_joined:${token}`);
  } catch {
    /* 무시 */
  }
}

/**
 * 참여 멱등 키 — 지도마다 하나. 더블클릭·새로고침 재제출이 같은 키로 가서
 * 서버의 unique(map_id, idempotency_key) 에 잡힌다.
 */
export function joinIdempotencyKey(token: string): string {
  const key = `lr_guin_idem:${token}`;
  const existing = read<string>(key);
  if (typeof existing === "string" && existing.length >= 8) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  write(key, fresh);
  return fresh;
}

// ── 참여자 → 자기 지도 프리필 ─────────────────────────────
// 참여 폼에 넣은 자기 값을 자기 지도 만들기에 재사용한다 (지시문 5항).
// sessionStorage 라 탭을 닫으면 사라진다. 동의는 저장하지 않는다 — 새 지도는
// 새로 동의해야 한다.

export interface GuinPrefill {
  nickname: string;
  birth: { year: number; month: number; day: number; hour: number | null };
}

const PREFILL_KEY = "lr_guin_prefill";

export function rememberGuinPrefill(value: GuinPrefill): void {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(value));
  } catch {
    /* 저장 실패면 그냥 다시 입력한다 */
  }
}

export function takeGuinPrefill(): GuinPrefill | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    sessionStorage.removeItem(PREFILL_KEY);
    const parsed = raw ? (JSON.parse(raw) as GuinPrefill) : null;
    return parsed?.nickname && parsed?.birth ? parsed : null;
  } catch {
    return null;
  }
}

// ── 공유 카피 배정 ────────────────────────────────────────
// 한 번 배정되면 그 브라우저에서는 같은 안을 계속 쓴다 — 같은 사람이 보낼
// 때마다 다른 카피가 나가면 실험이 오염된다.

const VARIANT_KEY = "lr_guin_copy_variant";

export function storedCopyVariant(assign: () => string): string {
  try {
    const existing = localStorage.getItem(VARIANT_KEY);
    if (existing === "A" || existing === "B" || existing === "C") return existing;
    const fresh = assign();
    localStorage.setItem(VARIANT_KEY, fresh);
    return fresh;
  } catch {
    return "A";
  }
}

/**
 * 저장된 내 사주(리딩 폼에서 저장된 것)를 귀인지도 폼 값으로 불러온다.
 * 없거나(리딩을 안 해봤거나) 실패하면 null — 조용히 빈 폼으로 물러난다.
 * 별명은 리딩 쪽에 없는 값이라 비워서 돌려준다.
 */
export async function fetchSavedBirth(userToken: string): Promise<GuinPrefill | null> {
  try {
    const res = await fetch("/api/reading/prefill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      me?: { year?: string; month?: string; day?: string; hour?: string } | null;
    };
    const me = data.me;
    if (!me?.year || !me.month || !me.day) return null;
    return {
      nickname: "",
      birth: {
        year: Number(me.year),
        month: Number(me.month),
        day: Number(me.day),
        hour: me.hour === undefined || me.hour === "unknown" ? null : Number(me.hour),
      },
    };
  } catch {
    return null;
  }
}

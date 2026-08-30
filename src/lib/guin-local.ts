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

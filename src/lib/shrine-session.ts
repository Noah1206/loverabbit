// 신당 대화 상태 — 입장 화면과 대화 화면이 나뉘어 있으므로 두 페이지가 같은 저장소를 본다.

export type ShrineMessage = { role: "user" | "assistant"; content: string };

const SESSION_PREFIX = "loverabbit_shrine_session_v1_";
const ARRIVAL_KEY = "loverabbit_shrine_arrival_v1";

function sessionKey(characterId: string) {
  return `${SESSION_PREFIX}${characterId}`;
}

export function loadShrineMessages(characterId: string): ShrineMessage[] {
  try {
    const stored = sessionStorage.getItem(sessionKey(characterId));
    if (!stored) return [];
    const parsed = JSON.parse(stored) as { messages?: ShrineMessage[] };
    return Array.isArray(parsed.messages) ? parsed.messages.slice(-21) : [];
  } catch {
    try {
      sessionStorage.removeItem(sessionKey(characterId));
    } catch {
      // 저장소를 못 쓰는 브라우저에서도 대화는 이어져야 한다
    }
    return [];
  }
}

export function saveShrineMessages(characterId: string, messages: ShrineMessage[]) {
  try {
    sessionStorage.setItem(sessionKey(characterId), JSON.stringify({ messages: messages.slice(-21) }));
  } catch {
    // 저장 실패는 대화를 막지 않는다
  }
}

// 관문 연출을 두 페이지에 걸쳐 이어 붙이기 위한 표시.
// 입장 화면이 켜두고, 대화 화면이 한 번 읽고 지운다 — 새로고침으로 다시 재생되지 않게.
export function markShrineArrival(characterId: string) {
  try {
    sessionStorage.setItem(ARRIVAL_KEY, characterId);
  } catch {
    // 표시를 못 남기면 연출 없이 바로 대화 화면이 뜬다
  }
}

export function consumeShrineArrival(characterId: string): boolean {
  try {
    const flagged = sessionStorage.getItem(ARRIVAL_KEY);
    if (flagged !== characterId) return false;
    sessionStorage.removeItem(ARRIVAL_KEY);
    return true;
  } catch {
    return false;
  }
}

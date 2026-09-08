// 마케팅 쿠키 동의 상태 — 동의 전에는 Meta Pixel 스크립트도, 어떤 마케팅 이벤트도 보내지 않는다.
// 값은 사용자 기기에만 남고 서버로 전송하지 않는다.

const STORAGE_KEY = "loverabbit-consent-v1";
const CHANGE_EVENT = "loverabbit-consent-change";

export type ConsentState = "granted" | "denied" | "unset";

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return "unset";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "granted" || raw === "denied" ? raw : "unset";
  } catch {
    // 시크릿 모드 등에서 localStorage 접근이 막히면 '동의하지 않음'으로 본다.
    return "unset";
  }
}

export function writeConsent(state: Exclude<ConsentState, "unset">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // 저장에 실패해도 이번 세션 동안은 아래 이벤트로 동작을 맞춘다.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: state }));
}

export function hasMarketingConsent(): boolean {
  return readConsent() === "granted";
}

// 배너에서 동의/거부를 누른 순간 Pixel 로더가 즉시 반응하도록 구독을 열어둔다.
export function onConsentChange(handler: (state: ConsentState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ConsentState>).detail;
    handler(detail ?? readConsent());
  };
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

// ── 환영 팝업과 겹치지 않게 ─────────────────────────────────────
//
// 처음 온 사람 화면에 팝업 둘이 동시에 떴다. 가운데는 1,900원 카드가,
// 아래는 쿠키 배너가 덮어 홈이 거의 보이지 않았다 — 둘 다 각자 layout 에
// 붙어 있고 서로를 몰랐다.
//
// 순서를 세운다. 환영 팝업이 떠 있는 동안 배너는 기다린다. 팝업이 닫히면
// 그때 올라온다. 이벤트로 잇는 이유는 둘이 형제 컴포넌트라 상태를 직접
// 주고받을 길이 없어서다.
export const WELCOME_OPEN_EVENT = "loverabbit:welcome-open";
export const WELCOME_CLOSED_EVENT = "loverabbit:welcome-closed";

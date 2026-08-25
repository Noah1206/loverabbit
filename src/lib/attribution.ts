// 광고 유입 출처 — 어느 소재가 이 결제를 만들었는가.
//
// 지금까지 Meta 이벤트에는 `landing_type`(어느 랜딩인지)만 실려 갔다. 랜딩이
// 다섯 개뿐이라 같은 랜딩에 소재를 여러 개 돌리면 어느 쪽이 판 것인지 구분되지
// 않는다. 링크에 붙여 보낸 UTM 을 받아 두었다가 주문에 함께 적는다.
//
// **주문 기록이 정본이다.** Meta 쪽 집계는 픽셀이 막히거나 동의를 안 받으면
// 비고, 그럴수록 실제로 판 광고가 무엇이었는지 알 수 없어진다. 우리 DB 의
// lr_orders.metadata.attribution 은 그 어느 것에도 기대지 않는다.

export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** Meta 가 링크에 붙여 보내는 클릭 식별자 */
  fbclid?: string;
  /** 들어온 자리 (경로만, 쿼리는 뺀다) */
  landing?: string;
  /** 언제 받았는지 (ms) */
  at?: number;
}

const KEY = "lr-attr";
/** 광고 클릭과 결제 사이의 창. Meta 기본 전환 기간과 맞춘다. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** 값 하나의 길이 상한 */
const MAX = 120;

/** 주소에서 받아 Meta 로도 되보내는 항목. 값이 전부 문자열인 것만 여기 든다. */
type TagField = "source" | "medium" | "campaign" | "content" | "term";

const FIELDS: Array<[TagField, string]> = [
  ["source", "utm_source"],
  ["medium", "utm_medium"],
  ["campaign", "utm_campaign"],
  ["content", "utm_content"],
  ["term", "utm_term"],
];

/**
 * 주소에서 온 값을 다듬는다.
 *
 * 이 값은 누구나 붙일 수 있는 주소에서 왔고, 우리 DB 와 Meta 로 함께 간다.
 * 제어문자를 버리고 길이를 자른다 — 관리자 화면과 로그를 헤집는 것을 막는다.
 */
export function cleanTag(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // 광고 링크의 한글 utm 은 두 번 인코딩돼 오기도 한다("%ED%8A%B8…"). 한 번 더 풀어 준다 -
  // 못 풀면 그대로 둔다. 관리자 화면에서 캠페인 이름이 퍼센트 기호로 보이던 이유다.
  const decoded = decodeOnce(value);
  const trimmed = decoded
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX);
  return trimmed || undefined;
}

/** 퍼센트 인코딩이 남아 있으면 한 번 푼다. 못 풀면 원문 그대로. */
export function decodeOnce(value: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) return value;
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** 빈 항목을 걷어낸다. 아무것도 안 남으면 null. */
export function normalizeAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value : undefined);

  const out: Attribution = {};
  for (const [key] of FIELDS) {
    const value = cleanTag(str(raw[key]));
    if (value) out[key] = value;
  }
  const fbclid = cleanTag(str(raw.fbclid));
  if (fbclid) out.fbclid = fbclid;

  const landing = cleanTag(str(raw.landing));
  // 경로만 받는다. 바깥 주소가 통째로 들어오는 것을 막는다.
  if (landing && landing.startsWith("/") && !landing.startsWith("//")) out.landing = landing;

  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : undefined;
  if (at) out.at = at;

  return Object.keys(out).length ? out : null;
}

/**
 * 주소에 붙어 온 출처를 받아 둔다.
 *
 * **마지막에 온 것이 이긴다.** 같은 사람이 광고를 두 번 눌렀다면 결제 직전에 누른
 * 쪽이 판 것에 가깝다. 대신 출처 표시가 하나도 없는 방문(직접 들어오기, 내부
 * 이동)은 기록을 덮지 않는다 — 그러면 광고로 들어와 며칠 뒤 결제한 사람의
 * 출처가 사라진다.
 */
export function captureAttribution(search: string, pathname: string): Attribution | null {
  if (typeof window === "undefined") return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return readAttribution();
  }

  const fresh: Attribution = {};
  for (const [key, param] of FIELDS) {
    const value = cleanTag(params.get(param));
    if (value) fresh[key] = value;
  }
  // fbclid 는 Meta 가 광고 클릭에 붙이는 식별자다. 우리 주문에 어느 광고였는지
  // 적어 두는 데 쓰고, Meta 로 되돌려 보내는 것은 동의가 있을 때뿐이다
  // (trackPurchase 가 동의 없이는 아예 보내지 않는다).
  const fbclid = cleanTag(params.get("fbclid"));
  if (fbclid) fresh.fbclid = fbclid;

  if (!Object.keys(fresh).length) return readAttribution();

  fresh.landing = pathname;
  fresh.at = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(fresh));
  } catch {
    // 저장이 막힌 브라우저. 이 방문 안에서는 아래 read 가 빈손으로 돌아오지만
    // 광고 추적 때문에 결제를 막을 이유는 없다.
  }
  return fresh;
}

/** 받아 둔 출처. 30일이 지났으면 없는 것으로 친다. */
export function readAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = normalizeAttribution(JSON.parse(raw));
    if (!parsed) return null;
    if (parsed.at && Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Meta 이벤트에 실을 모양.
 *
 * 파라미터 이름은 광고 관리자에서 그대로 보이므로 utm_ 이름을 유지한다.
 * landing·at·fbclid 는 우리 쪽 기록이라 여기 넣지 않는다 — fbclid 는 Meta 가
 * 이미 자기 쿠키로 알고 있다.
 */
export function attributionParams(attr: Attribution | null): Record<string, string> {
  if (!attr) return {};
  const out: Record<string, string> = {};
  for (const [key, param] of FIELDS) {
    const value = attr[key];
    if (typeof value === "string") out[param] = value;
  }
  return out;
}

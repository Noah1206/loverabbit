import { SITE_URL } from "@/lib/site";

export function safeNextPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host"))?.split(",")[0].trim();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol =
    forwardedProto?.split(",")[0].trim() ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  if (!host) return new URL(request.url).origin;

  const requestHost = host.toLowerCase();
  const requestOrigin = `${protocol}://${requestHost}`;
  if (process.env.NODE_ENV !== "production") return requestOrigin;

  const canonicalHost = new URL(SITE_URL).host.toLowerCase();
  if (requestHost === canonicalHost || requestHost === `www.${canonicalHost}`) return SITE_URL;

  // Vercel preview deployments keep their own origin so their PKCE cookie and callback stay together.
  if (requestHost.endsWith(".vercel.app")) return requestOrigin;

  // Never build a production OAuth redirect from an untrusted Host header.
  return SITE_URL;
}

/**
 * 로그인 오류 화면으로 보내되, 돌아갈 자리를 들려 보낸다.
 *
 * 로그인은 대개 무언가를 하려다 부딪히는 문이다 — 결과를 열려다, 결제를 하려다.
 * 실패했다고 홈으로 보내면 하려던 일이 사라진다. `next` 를 붙여 보내면 오류
 * 화면이 그 자리로 되돌려 준다.
 */
export function authErrorUrl(request: Request, reason: string, next?: string | null) {
  const url = new URL("/auth/error", requestOrigin(request));
  url.searchParams.set("reason", reason);
  const back = safeNextPath(next ?? null, "");
  if (back) url.searchParams.set("next", back);
  return url;
}

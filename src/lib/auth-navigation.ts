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

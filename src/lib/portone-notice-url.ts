export function buildPortOneNoticeUrl(
  origin: string,
  options: {
    vercelEnvironment?: string;
    automationBypassSecret?: string;
  } = {},
): string {
  const url = new URL("/api/portone/webhook", origin);
  const bypassSecret = options.automationBypassSecret?.trim();

  if (options.vercelEnvironment === "preview" && bypassSecret) {
    url.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  }

  return url.toString();
}

export function getPortOneNoticeUrl(origin: string): string {
  return buildPortOneNoticeUrl(origin, {
    vercelEnvironment: process.env.VERCEL_ENV,
    automationBypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  });
}

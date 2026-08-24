export function shouldRescueAuthCode(search: string, pendingReturn: string | null): boolean {
  if (!pendingReturn) return false;

  const params = new URLSearchParams(search);
  return Boolean(params.get("code") && !params.get("error"));
}

import { safeNextPath } from "@/lib/auth-navigation";
import AuthComplete from "./AuthComplete";

export default async function AuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  return <AuthComplete nextPath={safeNextPath(rawNext)} />;
}

import Link from "next/link";
import BrandMark from "@/components/BrandMark";

const MESSAGES: Record<string, string> = {
  provider_disabled: "로그인 제공자 설정이 아직 완료되지 않았어요.",
  invalid_provider: "지원하지 않는 로그인 방식이에요.",
  missing_code: "로그인 승인 정보를 받지 못했어요.",
  session_exchange_failed: "로그인 세션을 연결하지 못했어요.",
  oauth_start_failed: "로그인을 시작하지 못했어요.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const params = await searchParams;
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <div className="auth-rabbit" aria-hidden><BrandMark size={44} /></div>
        <h1>로그인을 완료하지 못했어요</h1>
        <p>{MESSAGES[reason ?? ""] ?? "잠시 후 다시 시도해주세요."}</p>
        <Link className="btn" href="/">홈으로 돌아가기</Link>
      </section>
    </main>
  );
}

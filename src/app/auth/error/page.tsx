import BrandMark from "@/components/BrandMark";
import BackOnError from "@/components/BackOnError";
import { safeNextPath } from "@/lib/auth-navigation";

const MESSAGES: Record<string, string> = {
  provider_disabled: "로그인 제공자 설정이 아직 완료되지 않았어요.",
  invalid_provider: "지원하지 않는 로그인 방식이에요.",
  missing_code: "로그인 승인 정보를 받지 못했어요.",
  session_exchange_failed: "로그인 세션을 연결하지 못했어요.",
  oauth_start_failed: "로그인을 시작하지 못했어요.",
};

/**
 * 로그인이 안 됐을 때.
 *
 * 예전에는 여기 "홈으로 돌아가기" 버튼 하나가 서 있었다. 로그인은 대개 무언가를
 * 하려다 부딪히는 문이다 — 결과를 열려다, 결제를 하려다. 그 사람을 홈으로 보내면
 * 하려던 일이 사라진다.
 *
 * 그래서 되돌아갈 자리(`next`)를 로그인 시작부터 여기까지 들고 온다. 뒤로 갈 데가
 * 있으면 뒤로, 없으면(광고로 바로 들어온 경우) `next` 로 보낸다.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[]; next?: string | string[] }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const reason = first(params.reason);
  // safeNextPath 가 바깥 주소로 튕겨 나가는 것을 막는다 — 오류 화면은 열린 문이라
  // 누구나 주소를 붙일 수 있다.
  const next = safeNextPath(first(params.next) ?? null);

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <div className="auth-rabbit" aria-hidden><BrandMark size={44} /></div>
        <h1>로그인을 완료하지 못했어요</h1>
        <p>{MESSAGES[reason ?? ""] ?? "잠시 후 다시 시도해주세요."}</p>
        <BackOnError fallback={next} label="이전 화면" />
      </section>
    </main>
  );
}

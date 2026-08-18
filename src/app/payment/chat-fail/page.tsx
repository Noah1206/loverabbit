import Link from "next/link";

export default async function ChatPaymentFailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const characterId = one(params.characterId) || "hwarin";
  const message = one(params.message) || "결제가 취소되었거나 완료되지 않았어요.";

  return (
    <main className="payment-result-shell">
      <section className="card payment-result-card">
        <div className="payment-result-icon" aria-hidden>×</div>
        <span className="badge">결제 미완료</span>
        <h1>대화권 결제가 진행되지 않았어요</h1>
        <p className="payment-result-error">{message}</p>
        <Link className="btn" href={`/shrine/${encodeURIComponent(characterId)}/chat`}>대화로 돌아가기</Link>
      </section>
    </main>
  );
}

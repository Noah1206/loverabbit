import PaymentSuccessClient from "./PaymentSuccessClient";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const readingId = one(params.readingId);
  const paymentKey = one(params.paymentKey);
  const orderId = one(params.orderId);
  const amount = Number(one(params.amount));

  return (
    <PaymentSuccessClient
      readingId={readingId}
      paymentKey={paymentKey}
      orderId={orderId}
      amount={amount}
    />
  );
}

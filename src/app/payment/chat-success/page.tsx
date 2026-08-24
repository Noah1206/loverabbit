import ChatPaymentSuccessClient from "./ChatPaymentSuccessClient";

export default async function ChatPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

  return (
    <ChatPaymentSuccessClient
      characterId={one(params.characterId)}
      paymentKey={one(params.paymentKey)}
      orderId={one(params.orderId)}
      amount={Number(one(params.amount))}
      paymentId={one(params.paymentId)}
      portOneCode={one(params.code)}
      portOneMessage={one(params.message)}
    />
  );
}

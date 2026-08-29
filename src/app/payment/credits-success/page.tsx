import CreditsSuccessClient from "./CreditsSuccessClient";

export default async function CreditsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] ?? "" : value ?? "");
  return (
    <CreditsSuccessClient
      paymentId={one(params.paymentId)}
      portOneCode={one(params.code)}
      portOneMessage={one(params.message)}
    />
  );
}

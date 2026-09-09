import { currentLuckPillars, JIJI_ANIMAL, CHEONGAN_OHAENG, JIJI_OHAENG } from "@/lib/saju";
import { previousMonthTerm, nextMonthTerm } from "@/lib/solar-terms";
import { displayTitle, type Product } from "@/lib/products";
import { josa, withJosa } from "@/lib/korean-josa";

/*
  이번 달이 사주로 무슨 달인가 — 상품 위에 붙이는 석 줄 (2026-09-09 운영자).

  파는 말이 아니라 사실이다. "이 리포트가 무엇을 근거로 이번 달을 읽는가" 를
  먼저 밝히면, 아래 목차가 어디서 나온 것인지가 선다.

  **전부 계산해서 쓴다.** 월주(정유)·연주(병오)는 saju.ts 가, 절기 경계
  (백로→한로)는 solar-terms.ts 가 황경으로 낸다. 손으로 적으면 다음 달에
  틀리고, 절입일은 해마다 하루씩 움직여서 작년 값을 그대로 두면 조용히
  거짓말이 된다.

  달이 없는 상품(신년·하반기·아이돌)에는 안 붙인다 — 그 상품이 보는 기간이
  이번 달이 아니라서 이 문단이 엉뚱한 말을 하게 된다.
*/

/** 오행의 빛깔 — "정유월, 붉은 닭의 달" 의 앞 두 글자 */
const OHAENG_COLOR: Record<string, string> = {
  목: "푸른",
  화: "붉은",
  토: "누런",
  금: "하얀",
  수: "검은",
};

/** 이번 달을 안 보는 상품. products.ts 의 NO_MONTH_PREFIX 와 같은 이유다 */
const NO_MONTH_NOTE = new Set(["sinnyeon", "habangi", "yeonae", "idol"]);

function seoulDate(ms: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(ms));
}

export default function ProductMonthNote({ product, now = new Date() }: { product: Product; now?: Date }) {
  if (NO_MONTH_NOTE.has(product.id)) return null;

  const { year, month, sajuYear } = currentLuckPillars(now);
  const prev = previousMonthTerm(now.getTime());
  const next = nextMonthTerm(now.getTime());

  const { ganIdx, jiIdx } = month;
  const monthName = `${month.gan}${month.ji}월`;
  // 빛깔은 천간에서, 짐승은 지지에서 온다 — 정유월이면 정(丁)=화=붉은 + 유(酉)=닭.
  // 둘 다 지지에서 뽑으면 "하얀 닭" 이 되는데, 그건 갑오·병오처럼 천간이 다른
  // 달을 전부 같은 색으로 부르게 된다.
  const color = OHAENG_COLOR[CHEONGAN_OHAENG[ganIdx]] ?? "";
  const animal = JIJI_ANIMAL[jiIdx];

  // "정화와 유금" — 천간·지지의 오행을 이름과 함께. 리포트가 무엇에 대입하는지다.
  const ganOhaeng = `${month.gan}${CHEONGAN_OHAENG[ganIdx]}`;
  const jiOhaeng = `${month.ji}${JIJI_OHAENG[jiIdx]}`;

  // 제목에서 달을 뗀 알맹이 — "9월 대인관계운" 의 "대인관계운"
  const topic = displayTitle(product, now).replace(/^\d+월\s*/, "");

  const calMonth = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", month: "numeric" }).format(now)
  );

  return (
    <section className="product-month-note product-reveal">
      <p>
        {sajuYear}년 {calMonth}월은 사주로 <strong>{monthName}</strong>, {color} {animal}의 달입니다.
      </p>
      <p>
        절기로는 {prev.name}부터 {next.name}까지로, {seoulDate(prev.utcMs)}부터{" "}
        {seoulDate(next.utcMs)}까지에 해당합니다.
      </p>
      <p>
        {monthName}에 들어온 {withJosa(ganOhaeng, "와과")} {jiOhaeng}의 오행을 기준으로 당신의 사주와{" "}
        {year.gan}{year.ji}년의 오행에 대입하여 {calMonth}월 {topic}
        {josa(topic, "을를")} 알려드립니다.
      </p>
    </section>
  );
}

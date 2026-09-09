import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { currentLuckPillars, CHEONGAN_OHAENG, JIJI_OHAENG, JIJI_ANIMAL } from "@/lib/saju";
import { previousMonthTerm, nextMonthTerm } from "@/lib/solar-terms";
import { josa } from "@/lib/korean-josa";

/*
  상품 상세의 "이번 달이 사주로 무슨 달인가" 문단.

  화면(ProductMonthNote.tsx)은 서버 컴포넌트라 여기서 렌더하지 않는다. 대신
  그 문단이 기대는 값들이 계속 맞는지를 본다 — 손으로 적은 것이 하나도
  없어야 다음 달에도 저절로 맞는다.
*/

describe("이번 달 안내", () => {
  it("빛깔은 천간에서, 짐승은 지지에서 온다", () => {
    // 정유월은 "붉은 닭" 이다. 정(丁)=화=붉은, 유(酉)=닭.
    // 둘 다 지지에서 뽑으면 "하얀 닭" 이 되는데, 그러면 천간이 다른 달들이
    // 전부 같은 색으로 불린다 — 을유·정유·기유·신유·계유가 다 하얀 닭이 된다.
    const sep2026 = new Date(2026, 8, 9);
    const { month } = currentLuckPillars(sep2026);
    assert.equal(`${month.gan}${month.ji}`, "정유");
    assert.equal(CHEONGAN_OHAENG[month.ganIdx], "화", "천간 정은 화다 — 붉은");
    assert.equal(JIJI_ANIMAL[month.jiIdx], "닭");
    // 지지의 오행(금=하얀)을 쓰면 안 된다는 것을 못 박는다
    assert.equal(JIJI_OHAENG[month.jiIdx], "금");
    assert.notEqual(CHEONGAN_OHAENG[month.ganIdx], JIJI_OHAENG[month.jiIdx]);
  });

  it("천간이 다른 유(酉)월은 색이 서로 다르다", () => {
    // 위 규칙이 실제로 갈라 주는지 — 색이 하나로 뭉치면 이 문단은 의미가 없다.
    const colors = new Set<string>();
    for (const year of [2021, 2022, 2023, 2024, 2025, 2026]) {
      const { month } = currentLuckPillars(new Date(year, 8, 20));
      assert.equal(month.ji, "유", `${year}년 9월 20일은 유월이어야 한다`);
      colors.add(CHEONGAN_OHAENG[month.ganIdx]);
    }
    assert.ok(colors.size >= 3, `유월의 색이 ${colors.size}가지뿐이다`);
  });

  it("절기 경계는 백로에서 한로까지다", () => {
    const sep2026 = new Date(2026, 8, 9).getTime();
    const prev = previousMonthTerm(sep2026);
    const next = nextMonthTerm(sep2026);
    assert.equal(prev.name, "백로");
    assert.equal(next.name, "한로");
    assert.ok(prev.utcMs < sep2026 && sep2026 < next.utcMs, "지금이 두 절기 사이에 있어야 한다");
  });

  it("절입 시각은 해마다 움직인다 — 그래서 손으로 안 적는다", () => {
    // 백로는 한 해에 약 5시간 46분씩 밀리다 윤년에 되감긴다. 며칠은 같은
    // 날짜에 머물지만 시각은 매년 다르고, 몇 해에 한 번은 날짜까지 넘어간다
    // (2027 백로는 KST 9월 8일 05시, 2028 은 9월 7일 11시). 그래서 굳혀
    // 적으면 어느 해엔가 조용히 틀린 날을 말하게 된다.
    const seoulDay = (ms: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", day: "numeric" }).format(new Date(ms));

    const moments = [2024, 2025, 2026, 2027, 2028].map((year) =>
      previousMonthTerm(new Date(year, 8, 20).getTime())
    );
    for (const m of moments) assert.equal(m.name, "백로");

    const times = new Set(moments.map((m) => m.utcMs));
    assert.equal(times.size, moments.length, "다섯 해의 백로 시각이 겹칠 리 없다");

    const days = new Set(moments.map((m) => seoulDay(m.utcMs)));
    assert.ok(days.size > 1, "다섯 해 안에는 날짜가 넘어가는 해가 있다");
  });

  it("제목 뒤 조사가 받침을 따라간다", () => {
    assert.equal(josa("속궁합", "을를"), "을");
    assert.equal(josa("재물운", "을를"), "을");
    assert.equal(josa("재회", "을를"), "를");
    assert.equal(josa("정화", "와과"), "와");
    assert.equal(josa("유금", "와과"), "과");
  });
});

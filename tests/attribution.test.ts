// 광고 유입 표시가 어디까지 통과하는지 붙잡아 둔다.
//
// 이 값은 주소에서 온다. 누구든 링크를 지어내 붙일 수 있고, 그대로 우리 DB 와
// 관리자 화면과 Meta 로 함께 간다. 그래서 여기서 새는 것은 오타가 아니라 구멍이다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { attributionParams, cleanTag, normalizeAttribution } from "@/lib/attribution";

describe("유입 표시 다듬기", () => {
  it("평범한 값은 그대로 통과한다", () => {
    assert.equal(cleanTag("meta"), "meta");
    assert.equal(cleanTag("  여름_궁합_A  "), "여름_궁합_A");
  });

  it("빈 값은 undefined 로 떨어진다", () => {
    assert.equal(cleanTag(""), undefined);
    assert.equal(cleanTag("   "), undefined);
    assert.equal(cleanTag(null), undefined);
    assert.equal(cleanTag(undefined), undefined);
  });

  it("제어문자를 걷어낸다 — 로그와 관리자 화면을 헤집지 못하게", () => {
    assert.equal(cleanTag("meta\u0000ads"), "metaads");
    assert.equal(cleanTag("a\nb\tc"), "abc");
    // 줄바꿈만 넣은 값은 남는 게 없으므로 없는 것으로 친다.
    assert.equal(cleanTag("\r\n"), undefined);
  });

  it("길이를 자른다", () => {
    const long = "가".repeat(500);
    assert.equal(cleanTag(long)?.length, 120);
  });
});

describe("유입 표시 정규화", () => {
  it("허용한 항목만 남긴다", () => {
    const out = normalizeAttribution({
      source: "meta",
      campaign: "summer",
      // 아래 둘은 우리가 받는 항목이 아니다. 통째로 흘려보내면 안 된다.
      password: "hunter2",
      report: "사주 결과 전문",
    });
    assert.deepEqual(out, { source: "meta", campaign: "summer" });
  });

  it("들어온 자리는 경로만 받는다", () => {
    assert.equal(normalizeAttribution({ source: "meta", landing: "/saju/compatibility" })?.landing,
      "/saju/compatibility");
    // 바깥 주소가 통째로 실려 오는 것을 막는다.
    assert.equal(normalizeAttribution({ source: "meta", landing: "https://evil.example" })?.landing,
      undefined);
    assert.equal(normalizeAttribution({ source: "meta", landing: "//evil.example" })?.landing,
      undefined);
  });

  it("아무것도 안 남으면 null", () => {
    assert.equal(normalizeAttribution({}), null);
    assert.equal(normalizeAttribution({ source: "" }), null);
    assert.equal(normalizeAttribution(null), null);
    assert.equal(normalizeAttribution("meta"), null);
    assert.equal(normalizeAttribution({ at: "어제" }), null);
  });

  it("받은 시각은 숫자일 때만", () => {
    assert.equal(normalizeAttribution({ source: "meta", at: 1_700_000_000_000 })?.at,
      1_700_000_000_000);
    assert.equal(normalizeAttribution({ source: "meta", at: Number.NaN })?.at, undefined);
    assert.equal(normalizeAttribution({ source: "meta", at: "1700000000000" })?.at, undefined);
  });
});

describe("Meta 로 보내는 모양", () => {
  it("utm 이름을 유지한다 — 광고 관리자에 그대로 보이는 이름이다", () => {
    assert.deepEqual(
      attributionParams({ source: "meta", medium: "cpc", campaign: "여름", content: "소재A" }),
      { utm_source: "meta", utm_medium: "cpc", utm_campaign: "여름", utm_content: "소재A" }
    );
  });

  it("우리 쪽 기록은 보내지 않는다", () => {
    const params = attributionParams({
      source: "meta",
      fbclid: "IwAR-abc",
      landing: "/saju/compatibility",
      at: 1_700_000_000_000,
    });
    assert.deepEqual(params, { utm_source: "meta" });
  });

  it("없으면 빈 객체", () => {
    assert.deepEqual(attributionParams(null), {});
  });
});

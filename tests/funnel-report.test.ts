import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFunnelReport, type FunnelEventRow } from "@/lib/funnel-report";
import { normalizePath, isFunnelEvent, isReadingStep } from "@/lib/funnel-events";

let clock = 0;
function event(
  session: string,
  name: string,
  extra: Partial<FunnelEventRow> = {}
): FunnelEventRow {
  clock += 1;
  return {
    session_id: session,
    user_id: null,
    name,
    step: null,
    path: null,
    product: null,
    dwell_ms: null,
    seq: clock,
    created_at: new Date(1_800_000_000_000 + clock * 1000).toISOString(),
    ...extra,
  };
}

describe("경로 접기", () => {
  it("리딩 id 를 한 줄로 모은다", () => {
    assert.equal(normalizePath("/reading/9c1f2b3a-1111-2222-3333-444455556666"), "/reading/[id]");
    assert.equal(normalizePath("/reading/generating"), "/reading/generating");
    assert.equal(normalizePath("/reading/generating?x=1"), "/reading/generating");
  });

  it("쿼리와 해시를 버린다", () => {
    assert.equal(normalizePath("/saju/inner-mind?utm_source=meta#top"), "/saju/inner-mind");
  });

  it("경로가 아닌 것은 받지 않는다", () => {
    assert.equal(normalizePath("https://evil.example/steal"), null);
    assert.equal(normalizePath(42), null);
  });
});

describe("허용 목록", () => {
  it("모르는 이름과 칸은 거른다", () => {
    assert.equal(isFunnelEvent("page_view"), true);
    assert.equal(isFunnelEvent("drop_table"), false);
    assert.equal(isReadingStep("meBirth"), true);
    assert.equal(isReadingStep("<script>"), false);
  });
});

describe("퍼널 집계", () => {
  it("단계마다 사람 수를 세고 사이에서 잃은 수를 낸다", () => {
    const rows = [
      // 둘은 폼까지, 하나만 리딩까지 갔다.
      event("s1", "step_view", { step: "category" }),
      event("s1", "preview_requested"),
      event("s1", "preview_generated"),
      event("s1", "reading_view"),
      event("s2", "step_view", { step: "category" }),
      event("s2", "preview_requested"),
      event("s3", "step_view", { step: "category" }),
    ];
    const report = buildFunnelReport(rows);
    const stage = (name: string) => report.stages.find((s) => s.name === name)!;

    assert.equal(report.sessions, 3);
    assert.equal(stage("step_view").sessions, 3);
    assert.equal(stage("step_view").dropped, 1, "폼을 열고 제출 안 한 사람 하나");
    assert.equal(stage("preview_requested").sessions, 2);
    assert.equal(stage("preview_requested").dropped, 1, "제출했는데 생성까지 못 간 사람 하나");
    assert.equal(stage("preview_generated").passRate, 50);
  });

  it("사건이 아니라 사람을 센다 — 앞뒤로 오가도 하나다", () => {
    const rows = [
      event("s1", "step_view", { step: "meBirth" }),
      event("s1", "step_view", { step: "meDetails" }),
      event("s1", "step_view", { step: "meBirth" }),
      event("s1", "step_view", { step: "meDetails" }),
    ];
    const report = buildFunnelReport(rows);
    assert.equal(report.stages.find((s) => s.name === "step_view")!.sessions, 1);
    assert.equal(report.formSteps.find((s) => s.step === "meBirth")!.reached, 1);
  });

  it("폼을 끝내지 못한 세션의 마지막 칸을 이탈로 잡는다", () => {
    const rows = [
      event("s1", "step_view", { step: "category" }),
      event("s1", "step_view", { step: "meBirth" }),
      event("s1", "step_view", { step: "concern" }),
      // s2 는 끝까지 갔다 — 이탈로 세면 안 된다.
      event("s2", "step_view", { step: "category" }),
      event("s2", "step_view", { step: "meBirth" }),
      event("s2", "preview_requested"),
    ];
    const report = buildFunnelReport(rows);
    const step = (name: string) => report.formSteps.find((s) => s.step === name)!;
    assert.equal(step("concern").abandoned, 1);
    assert.equal(step("meBirth").abandoned, 0, "제출한 세션은 어느 칸의 이탈도 아니다");
    assert.equal(step("meBirth").reached, 2);
  });

  it("세션의 마지막 화면이 이탈 지점이다", () => {
    const rows = [
      event("s1", "page_view", { path: "/saju/inner-mind" }),
      event("s1", "page_exit", { path: "/saju/inner-mind", dwell_ms: 4000 }),
      event("s1", "page_view", { path: "/reading" }),
      event("s1", "page_exit", { path: "/reading", dwell_ms: 20000 }),
      event("s2", "page_view", { path: "/reading" }),
      event("s2", "page_exit", { path: "/reading", dwell_ms: 10000 }),
    ];
    const report = buildFunnelReport(rows);
    const page = (path: string) => report.pages.find((p) => p.path === path)!;
    assert.equal(page("/reading").exits, 2, "둘 다 /reading 에서 나갔다");
    assert.equal(page("/saju/inner-mind").exits, 0);
    assert.equal(page("/reading").medianDwellMs, 15000);
    assert.equal(report.pages[0].path, "/reading", "이탈이 많은 화면이 위로");
  });

  it("이탈 신호가 없어도 마지막으로 연 화면을 이탈로 본다", () => {
    // 브라우저가 pagehide 를 못 보내고 죽는 경우. 그래도 답은 나와야 한다.
    const rows = [event("s1", "page_view", { path: "/reading" })];
    const report = buildFunnelReport(rows);
    assert.equal(report.pages.find((p) => p.path === "/reading")!.exits, 1);
  });

  it("묶여 온 사건도 seq 로 앞뒤를 세운다", () => {
    // 같은 밀리초에 도착한 두 사건. created_at 으로 세우면 뒤집힐 수 있다.
    const same = new Date(1_800_000_000_000).toISOString();
    const rows: FunnelEventRow[] = [
      { ...event("s1", "step_view", { step: "concern" }), seq: 9, created_at: same },
      { ...event("s1", "step_view", { step: "category" }), seq: 2, created_at: same },
    ];
    const report = buildFunnelReport(rows);
    assert.equal(
      report.formSteps.find((s) => s.step === "concern")!.abandoned,
      1,
      "나중 seq 인 concern 이 마지막 칸이다"
    );
  });

  it("빈 자료에도 무너지지 않는다", () => {
    const report = buildFunnelReport([]);
    assert.equal(report.sessions, 0);
    assert.equal(report.pages.length, 0);
    assert.equal(report.stages.length > 0, true);
  });
});

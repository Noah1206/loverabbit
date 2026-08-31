import assert from "node:assert/strict";
import { test } from "node:test";

import { INTRO_BEATS } from "@/components/GuinMapIntro";

// 오프닝 길이는 눈으로만 보면 조용히 늘어난다. 장면 표를 직접 잰다.
// 지시문 6항이 정한 경계 — full 4~6초, compact 1초 안.

test("full 오프닝은 4~6초 안에 끝난다", () => {
  const total = INTRO_BEATS.full[3];
  assert.ok(total >= 4000, `너무 짧다: ${total}ms`);
  assert.ok(total <= 6000, `너무 길다: ${total}ms`);
});

test("compact 오프닝은 1초 안에 끝난다", () => {
  const total = INTRO_BEATS.compact[3];
  assert.ok(total <= 1000, `너무 길다: ${total}ms`);
});

test("장면은 순서대로 온다", () => {
  for (const mode of ["full", "compact"] as const) {
    const beats = INTRO_BEATS[mode];
    for (let i = 1; i < beats.length; i += 1) {
      assert.ok(beats[i] > beats[i - 1], `${mode} 장면 ${i} 가 앞 장면보다 이르다`);
    }
  }
});

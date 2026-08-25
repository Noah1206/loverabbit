import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cleanTag, decodeOnce } from "@/lib/attribution";

describe("utm 한글 디코딩", () => {
  it("퍼센트 인코딩을 한 번 푼다", () => {
    assert.equal(decodeOnce("%EC%9D%B4%EB%B3%84%EC%82%AC%EC%A3%BC"), "이별사주");
    assert.equal(cleanTag("%EC%9D%B4%EB%B3%84+%EC%82%AC%EC%A3%BC"), "이별 사주");
  });

  it("이미 풀린 값과 중괄호 원문은 그대로 둔다", () => {
    assert.equal(decodeOnce("이별사주"), "이별사주");
    assert.equal(cleanTag("{{campaign.name}}"), "{{campaign.name}}");
    assert.equal(cleanTag("meta"), "meta");
  });

  it("깨진 인코딩은 원문 그대로 남긴다", () => {
    assert.equal(decodeOnce("%E0%A4%A"), "%E0%A4%A");
    assert.equal(cleanTag("100%EC"), "100%EC");
  });
});

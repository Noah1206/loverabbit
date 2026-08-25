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

  it("통째로 깨진 인코딩은 원문 그대로, 꼬리만 깨진 것은 꼬리를 버린다", () => {
    assert.equal(decodeOnce("%E0%A4%A"), "%E0%A4%A");
    assert.equal(cleanTag("100%EC"), "100");
  });
});

describe("잘린 utm", () => {
  it("꼬리가 잘린 인코딩은 읽히는 데까지만 푼다", () => {
    assert.equal(decodeOnce("%EC%97%B0%EC%95%A0%EC%9A%B4_%EC%82%AC%EC%A3%BC%EA%B4%91%EA%B3%"), "연애운_사주광");
    assert.equal(decodeOnce("%EC%9D%B4%EB%B3%84_%ED%8C%90%EB%8B%A8%EA%B8%B0%EC%A"), "이별_판단기");
    assert.equal(decodeOnce("%EC%86%8D%EA%B6%81%ED%95%A9_%EC%82%AC%EC%A3%2"), "속궁합_사");
  });
});

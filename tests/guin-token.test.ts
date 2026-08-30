import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashKey, keyMatches, newSecretKey, newShareToken } from "../src/lib/guin-token";

describe("귀인 지도 열쇠", () => {
  it("공유 토큰은 주소에 안전한 24자 무작위다", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const token = newShareToken();
      assert.match(token, /^[A-Za-z0-9_-]{24}$/);
      seen.add(token);
    }
    assert.equal(seen.size, 200, "토큰이 겹쳤다");
  });

  it("키는 해시로만 저장되고, 검증은 원문으로 한다", () => {
    const key = newSecretKey();
    const stored = hashKey(key);
    assert.match(stored, /^[0-9a-f]{64}$/);
    assert.ok(keyMatches(key, stored));
    assert.ok(!keyMatches(newSecretKey(), stored));
    assert.ok(!keyMatches(null, stored));
    assert.ok(!keyMatches("", stored));
  });
});

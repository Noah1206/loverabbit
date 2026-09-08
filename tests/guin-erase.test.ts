// 본인 요청 삭제 — 지문이 저장할 때와 지울 때 같아야 한다.
//
// 이게 어긋나면 화면은 멀쩡한데 아무것도 안 지워진다. "지웠어요" 라고 말하고
// 실제로는 남아 있는 것이 개인정보에서 가장 나쁜 실패라, 그 한 가지를 잰다.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { participantFingerprint } from "../src/lib/guin-token";

/** joinGuinMap 이 저장할 때 만드는 모양 (guin-db.ts) */
function onJoin(mapId: string, birth: { year: number; month: number; day: number }, nickname: string) {
  return participantFingerprint(mapId, `${birth.year}-${birth.month}-${birth.day}`, nickname);
}

/** eraseByFingerprint 가 지울 때 만드는 모양 (guin-db.ts) */
function onErase(mapId: string, birth: { year: number; month: number; day: number }, nickname: string) {
  return participantFingerprint(mapId, `${birth.year}-${birth.month}-${birth.day}`, nickname);
}

describe("지문 — 넣을 때와 지울 때가 같은가", () => {
  const map = "map-1";
  const birth = { year: 1995, month: 3, day: 7 };

  it("같은 사람이면 같은 지문", () => {
    assert.equal(onJoin(map, birth, "민지"), onErase(map, birth, "민지"));
  });

  it("별명 앞뒤 공백은 무시된다 — 손으로 다시 칠 때 흔한 차이다", () => {
    assert.equal(onJoin(map, birth, "민지"), onErase(map, birth, "  민지  "));
  });

  it("생일이 다르면 다른 지문 — 별명만으로는 못 지운다", () => {
    assert.notEqual(onJoin(map, birth, "민지"), onErase(map, { ...birth, day: 8 }, "민지"));
  });

  it("월·일을 0으로 채워 쓰면 다른 지문이 된다", () => {
    // 저장은 숫자 그대로다(3-7). 화면이 "03-07" 로 보내면 안 맞는다 —
    // 그래서 두 곳 다 Number 로 받아 같은 모양을 만든다.
    assert.notEqual(
      participantFingerprint(map, "1995-3-7", "민지"),
      participantFingerprint(map, "1995-03-07", "민지")
    );
  });

  it("지도가 다르면 다른 지문 — 한 지도에서 지워도 다른 지도는 안 건드린다", () => {
    assert.notEqual(onJoin("map-1", birth, "민지"), onErase("map-2", birth, "민지"));
  });
});

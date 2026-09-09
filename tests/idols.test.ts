// 최애 명단 — 값이 틀리면 명식이 통째로 틀린다.
//
// 이 표의 생년월일 하나가 어긋나면 그 사람으로 나간 리포트 전부가 다른 사람의
// 명식이 된다. 되돌릴 수 없으므로 꼴이라도 여기서 잡는다.

import assert from "node:assert/strict";
import test from "node:test";

import { IDOL_CHIP_ORDER, IDOL_GROUPS, IDOL_GROUP_MAP } from "../src/lib/idols";

test("그룹 id 와 이름이 겹치지 않는다", () => {
  const ids = IDOL_GROUPS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, "id 가 겹친다");
  const labels = IDOL_GROUPS.map((g) => g.label);
  assert.equal(new Set(labels).size, labels.length, "이름이 겹친다");
});

test("생년월일이 실제로 있는 날짜다", () => {
  for (const g of IDOL_GROUPS) {
    for (const m of g.members) {
      assert.match(m.birth, /^\d{4}-\d{2}-\d{2}$/, `${g.label} ${m.name}: 꼴이 틀렸다`);
      const [y, mo, d] = m.birth.split("-").map(Number);
      const date = new Date(Date.UTC(y, mo - 1, d));
      assert.equal(date.getUTCFullYear(), y, `${g.label} ${m.name}: 없는 날짜다`);
      assert.equal(date.getUTCMonth() + 1, mo, `${g.label} ${m.name}: 없는 날짜다`);
      assert.equal(date.getUTCDate(), d, `${g.label} ${m.name}: 없는 날짜다`);
      // 아이돌이 1950년생일 리 없고, 미래일 리도 없다 — 오타를 잡는 폭이다.
      assert.ok(y >= 1960 && y <= new Date().getFullYear(), `${g.label} ${m.name}: 연도가 이상하다`);
    }
  }
});

test("그룹마다 멤버가 있고 이름이 겹치지 않는다", () => {
  for (const g of IDOL_GROUPS) {
    assert.ok(g.members.length > 0, `${g.label}: 멤버가 없다`);
    const names = g.members.map((m) => m.name);
    assert.equal(new Set(names).size, names.length, `${g.label}: 멤버 이름이 겹친다`);
  }
});

test("칩 목록은 전부 실제 그룹이다", () => {
  for (const id of IDOL_CHIP_ORDER) {
    assert.ok(IDOL_GROUP_MAP.has(id), `${id} 는 명단에 없는 그룹이다`);
  }
});

test("공개 프로필 밖의 것을 담지 않는다", () => {
  // 이 표가 들고 있어도 되는 것은 그룹·활동명·생년월일뿐이다. 칸이 늘면
  // 그때부터 이 저장소가 실존 인물의 개인정보를 관리하는 일이 된다.
  const allowedGroup = new Set(["id", "label", "aliases", "members"]);
  const allowedMember = new Set(["name", "birth"]);
  for (const g of IDOL_GROUPS) {
    for (const k of Object.keys(g)) {
      assert.ok(allowedGroup.has(k), `그룹에 "${k}" 칸이 생겼다 — 담아도 되는 것인지 먼저 정한다`);
    }
    for (const m of g.members) {
      for (const k of Object.keys(m)) {
        assert.ok(allowedMember.has(k), `멤버에 "${k}" 칸이 생겼다 — 담아도 되는 것인지 먼저 정한다`);
      }
    }
  }
});

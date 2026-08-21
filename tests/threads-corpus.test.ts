// 코퍼스가 근거로 쓸 수 있는 상태인지 붙잡아 둔다.
//
// 이 파일이 지키는 것은 하나다 — "허가 코퍼스 기반"이라고 말할 때 그 말이 참인가.
// 패턴이 없는 게시물을 가리키거나, 초안이 코퍼스 밖의 글을 출처로 적으면
// 그 말은 거짓이 된다.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  EXPECTED_PERMISSION_SCOPE,
  EXPECTED_SOURCE_METHOD,
  REQUIRED_FIELDS,
  directCopyEligible,
  loadCorpus,
  loadLibrary,
  parseCorpus,
  unknownSourceIds,
  validateLibrary,
} from "@/lib/threads-corpus";

const corpus = loadCorpus();
const library = loadLibrary();

describe("코퍼스 11개 행", () => {
  it("전부 파싱된다", () => {
    assert.equal(corpus.rows.length, 11);
  });

  it("blocking 오류가 없다", () => {
    const blocking = corpus.issues.filter((i) => i.blocking);
    assert.deepEqual(blocking, [], `blocking 오류: ${JSON.stringify(blocking)}`);
  });

  it("필수 필드가 전부 있다", () => {
    for (const row of corpus.rows) {
      for (const field of REQUIRED_FIELDS) {
        const value = (row as unknown as Record<string, unknown>)[field];
        assert.equal(typeof value, "string", `${row.post_id}.${field}`);
        assert.notEqual((value as string).trim(), "", `${row.post_id}.${field} 가 비었다`);
      }
    }
  });

  it("post_id가 중복되지 않는다", () => {
    const ids = corpus.rows.map((r) => r.post_id);
    assert.equal(new Set(ids).size, ids.length);
  });

  // 허가의 근거가 무엇인지 코드가 기억하게 둔다. 값이 바뀌면 테스트가 먼저 말한다 —
  // 사주시바가 직접 내보낸 원문을 합치는 날, source_method 가 달라질 것이다.
  it("출처와 허가 근거가 v1 값 그대로다", () => {
    for (const row of corpus.rows) {
      assert.equal(row.source_method, EXPECTED_SOURCE_METHOD, row.post_id);
      assert.equal(row.permission_scope, EXPECTED_PERMISSION_SCOPE, row.post_id);
    }
  });

  it("부모 글이 없는 행은 원문 직접 재사용 대상에서 빠진다", () => {
    const partial = corpus.rows.filter((r) => r.extraction_status === "partial_parent_unavailable");
    assert.equal(partial.length, 1, "v1에는 잘린 행이 하나 있다");
    const eligible = directCopyEligible(corpus.rows).map((r) => r.post_id);
    assert.equal(eligible.includes(partial[0].post_id), false);
  });
});

describe("깨진 행은 넘어가지 않는다", () => {
  it("JSON이 아니면 잡는다", () => {
    const result = parseCorpus('{"post_id":"A"\n');
    assert.equal(result.ok, false);
    assert.match(result.issues[0].detail, /파싱 실패/);
  });

  it("필드가 비면 잡는다", () => {
    const line = JSON.stringify({
      post_id: "A",
      body: "",
      permission_scope: "x",
      source_method: "y",
      extraction_status: "complete",
    });
    const result = parseCorpus(line);
    assert.equal(result.ok, false);
    assert.match(result.issues[0].detail, /필수 필드 누락/);
  });

  it("한 행이 깨져도 나머지는 읽는다", () => {
    const good = JSON.stringify({
      post_id: "A",
      body: "본문",
      permission_scope: EXPECTED_PERMISSION_SCOPE,
      source_method: EXPECTED_SOURCE_METHOD,
      extraction_status: "complete",
    });
    const result = parseCorpus(`{ 깨짐\n${good}`);
    assert.equal(result.rows.length, 1);
    assert.equal(result.ok, false);
  });
});

describe("패턴 라이브러리 참조 무결성", () => {
  it("8개 패턴이 있고 blocking 오류가 없다", () => {
    assert.equal(library.patterns.length, 8);
    const blocking = validateLibrary(library, corpus.rows).filter((i) => i.blocking);
    assert.deepEqual(blocking, [], `blocking 오류: ${JSON.stringify(blocking)}`);
  });

  it("모든 source_post_id가 코퍼스에 있다", () => {
    const ids = library.patterns.flatMap((p) => p.source_post_ids);
    assert.deepEqual(unknownSourceIds(ids, corpus.rows), []);
  });

  it("코퍼스에 없는 게시물을 가리키면 blocking으로 잡는다", () => {
    const tampered = {
      ...library,
      patterns: [{ ...library.patterns[0], source_post_ids: ["SS-없는글"] }],
    };
    const issues = validateLibrary(tampered, corpus.rows);
    assert.equal(issues.some((i) => i.blocking && /코퍼스에 없는/.test(i.detail)), true);
  });
});

describe("코퍼스 밖 출처는 막는다", () => {
  it("제3자 게시물 ID를 골라낸다", () => {
    const unknown = unknownSourceIds(
      ["SS-20260703-WEEKLY-TOP5", "OTHER-ACCOUNT-001"],
      corpus.rows
    );
    assert.deepEqual(unknown, ["OTHER-ACCOUNT-001"]);
  });
});

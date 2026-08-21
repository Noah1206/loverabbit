// 사주 입력 초안이 지키는 것: "생성 중에 뒤로가기·새로고침을 해도 입력이 살아남는다."
//
// 흐름이 세 화면에 걸쳐 있다 — 폼이 저장하고, 생성 화면이 소비하되 자동 재개 없는
// 사본을 되돌려 두고, 폼은 그 사본을 값 복원에만 쓴다. 셋 중 하나만 어긋나도
// 생년월일 넷에 고민 한 줄까지 적은 사람이 빈 폼을 다시 만나거나(소비만 하고 끝),
// 폼과 생성 화면이 서로를 계속 부르는 되돌이표가 생긴다(무조건 자동 재개).

import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";

// reading-draft 는 브라우저 전용이라 sessionStorage 를 폴리필한다.
// 정적 import 여도 안전하다 — 모듈 본문은 함수 정의뿐이고, sessionStorage 는
// 함수를 부를 때에야 읽는다. 폴리필은 첫 호출 전에만 서 있으면 된다.
import {
  clearReadingDraft,
  emptyPerson,
  peekReadingDraft,
  saveReadingDraft,
  takeReadingDraft,
} from "@/lib/reading-draft";

const store = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const draft = () => ({
  category: "sokgunghap",
  me: { ...emptyPerson, year: "1999", month: "3", day: "14", gender: "F" },
  partner: { ...emptyPerson, year: "1998", month: "7", day: "2", gender: "M" },
  withPartner: true,
  question: "요즘 연락이 뜸해요",
  occupation: "간호사",
  createdAt: Date.now(),
});

describe("사주 입력 초안", () => {
  beforeEach(() => store.clear());

  it("생성 화면의 소비-후-백업을 거치면 뒤로가기에 값이 살아남는다", () => {
    saveReadingDraft(draft());

    // 생성 화면이 하는 일: 소비 → 자동 재개 없는 사본을 되돌려 둠
    const job = takeReadingDraft();
    assert.ok(job, "소비할 초안이 있어야 한다");
    saveReadingDraft({ ...job, autoResume: false });

    // 뒤로가기 → 폼이 peek: 값은 그대로, 자동 재개는 꺼져 있다
    const restored = peekReadingDraft();
    assert.ok(restored);
    assert.equal(restored.me.year, "1999");
    assert.equal(restored.question, "요즘 연락이 뜸해요");
    assert.equal(restored.autoResume, false);
  });

  it("생성 중 새로고침하면 초안이 남아 있어 이어서 돌릴 수 있다", () => {
    saveReadingDraft(draft());
    const job = takeReadingDraft();
    assert.ok(job);
    saveReadingDraft({ ...job, autoResume: false });

    // 새로고침 → 생성 화면이 다시 소비한다. 백업이 없었다면 여기가 null 이고,
    // 사용자는 빈 폼으로 쫓겨난다.
    assert.ok(takeReadingDraft());
  });

  it("성공하면 백업까지 비워져 다음 방문이 깨끗하다", () => {
    saveReadingDraft(draft());
    const job = takeReadingDraft();
    assert.ok(job);
    saveReadingDraft({ ...job, autoResume: false });

    clearReadingDraft(); // 생성 성공 시점
    assert.equal(peekReadingDraft(), null);
  });

  it("로그인 복귀 초안(autoResume 미지정)은 자동 재개 대상이다", () => {
    // 폼이 저장하는 초안에는 autoResume 이 없다 — 없음은 곧 재개해도 된다는 뜻.
    // 폼의 조건이 `autoResume !== false` 인 이유다.
    saveReadingDraft(draft());
    const restored = peekReadingDraft();
    assert.ok(restored);
    assert.notEqual(restored.autoResume, false);
  });

  it("소비는 한 번만 — 두 번째 take 는 비어 있다", () => {
    saveReadingDraft(draft());
    assert.ok(takeReadingDraft());
    assert.equal(takeReadingDraft(), null);
  });
});

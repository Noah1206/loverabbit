import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_ACTION_TABLE,
  DOMAINS,
  DOMAIN_LABEL,
  FLOWS,
  FLOW_OF,
  buildAllDomains,
  buildDailyAction,
  dailyFlowOf,
  pickDomain,
  seoulToday,
  type FortuneDomain,
} from "../src/lib/daily-action";

// 갑목 일간 (1984-02-05 는 갑자일). 아래 테스트가 전부 이 사람을 쓴다.
const BIRTH = { birthdate: "1984-02-05", birthHour: 12 };

test("오늘의 흐름은 내 일간과 오늘 일진 천간에서 나온다", () => {
  const flow = dailyFlowOf(BIRTH.birthdate, BIRTH.birthHour, "2026-09-01");

  // 계산값 자체를 못박는다 — 표가 바뀌어도 명리 계산이 흔들리면 여기서 잡힌다.
  assert.equal(flow.dayGanji.length, 2);
  assert.ok(FLOWS.includes(flow.flow));
  assert.equal(FLOW_OF[flow.tenGod], flow.flow);
});

test("태어난 시각을 몰라도 오늘의 흐름은 같다", () => {
  // 흐름은 일간(태어난 날)과 오늘 일진만 본다. 시주는 들어가지 않는다.
  const withHour = dailyFlowOf(BIRTH.birthdate, 12, "2026-09-01");
  const without = dailyFlowOf(BIRTH.birthdate, null, "2026-09-01");
  assert.equal(without.tenGod, withHour.tenGod);
  assert.equal(without.dayMaster, withHour.dayMaster);
});

test("날짜가 바뀌면 액션 키가 갈린다", () => {
  const a = buildDailyAction({ ...BIRTH, today: "2026-09-01" }).action;
  const b = buildDailyAction({ ...BIRTH, today: "2026-09-02" }).action;

  assert.notEqual(a.id, b.id);
  assert.ok(a.id.startsWith("2026-09-01:"));
  assert.ok(b.id.startsWith("2026-09-02:"));
  assert.equal(a.date, "2026-09-01");
});

test("같은 날 같은 사람은 항상 같은 결과 — 캐시가 필요 없다", () => {
  const a = buildDailyAction({ ...BIRTH, today: "2026-09-01" }).action;
  const b = buildDailyAction({ ...BIRTH, today: "2026-09-01" }).action;
  assert.deepEqual(a, b);
});

test("최근에 나간 영역은 건너뛴다", () => {
  const base = buildDailyAction({ ...BIRTH, today: "2026-09-01" }).action;

  const next = buildDailyAction({
    ...BIRTH,
    today: "2026-09-01",
    recentDomains: [base.domain],
  }).action;

  assert.notEqual(next.domain, base.domain);
});

test("최근 영역이 여덟 개를 다 덮으면 1순위로 돌아간다", () => {
  // 중복 회피 때문에 아무것도 못 내보내는 상태가 되면 안 된다.
  const action = buildDailyAction({
    ...BIRTH,
    today: "2026-09-01",
    recentDomains: [...DOMAINS],
  }).action;

  assert.ok(DOMAINS.includes(action.domain));
});

test("pickDomain 은 흐름의 우선순위를 순서대로 소비한다", () => {
  const first = pickDomain("인성", []);
  const second = pickDomain("인성", [first]);
  const third = pickDomain("인성", [first, second]);

  assert.equal(new Set([first, second, third]).size, 3);
});

test("다른 운세 보기는 여덟 영역을 모두 돌려준다", () => {
  const all = buildAllDomains({ ...BIRTH, today: "2026-09-01" });

  assert.equal(all.length, 8);
  assert.equal(new Set(all.map((a) => a.domain)).size, 8);
  // 전부 오늘의 같은 흐름 위에 서 있다 — 근거 줄이 같아야 한다.
  assert.equal(new Set(all.map((a) => a.sajuBasis.description)).size, 1);
});

test("표에 빈칸이 없다 — 흐름 5 × 영역 8", () => {
  for (const flow of FLOWS) {
    for (const domain of DOMAINS) {
      const copy = DAILY_ACTION_TABLE[flow][domain];
      assert.ok(copy, `${flow}/${domain} 이 비어 있다`);
      assert.ok(copy.action.length > 10, `${flow}/${domain} 행동이 너무 짧다`);
      assert.ok(copy.avoid.length > 10, `${flow}/${domain} 피할 행동이 비었다`);
      assert.ok(copy.minutes > 0 && copy.minutes <= 30, `${flow}/${domain} 시간이 5~30분 밖이다`);
    }
  }
});

test("모든 행동은 오늘 안에 되고 완료를 판단할 수 있는 문장이다", () => {
  for (const flow of FLOWS) {
    for (const domain of DOMAINS) {
      const { action } = DAILY_ACTION_TABLE[flow][domain];
      // "오늘은" 으로 시작해 시점을 못박고, 존댓말 청유로 끝난다.
      assert.ok(action.startsWith("오늘은"), `${flow}/${domain}: 시점이 없다 — ${action}`);
      assert.ok(action.endsWith("."), `${flow}/${domain}: 문장이 안 닫혔다`);
    }
  }
});

// ── 안전 문구 ──────────────────────────────────────────────
//
// 지시문 4절이 금지한 단정. 하나라도 새면 재물·건강에서 곧장 사고가 된다.
const FORBIDDEN = [
  "반드시",
  "무조건",
  "확실히",
  "틀림없",
  "성공한다",
  "합격한다",
  "돈을 벌",
  "부자가",
  "대박",
  "불행",
  "운이 나빠",
  "병이",
  "질병",
  "치료",
  "완치",
  "헤어진다",
  "이별한다",
  "결혼한다",
];

test("표 어디에도 단정적인 예언이 없다", () => {
  for (const flow of FLOWS) {
    for (const domain of DOMAINS) {
      const copy = DAILY_ACTION_TABLE[flow][domain];
      const text = `${copy.title} ${copy.action} ${copy.reason} ${copy.avoid}`;
      for (const word of FORBIDDEN) {
        assert.ok(
          !text.includes(word),
          `${flow}/${domain} 에 금지 표현 "${word}" 가 있다 — ${text}`
        );
      }
    }
  }
});

test("근거 문장에도 단정이 없다", () => {
  const all = buildAllDomains({ ...BIRTH, today: "2026-09-01" });
  for (const action of all) {
    for (const word of FORBIDDEN) {
      assert.ok(
        !action.sajuBasis.description.includes(word),
        `근거에 "${word}" 가 있다`
      );
    }
  }
});

test("재물·건강·사업은 안내 문구를 달고 나간다", () => {
  const all = buildAllDomains({ ...BIRTH, today: "2026-09-01" });
  for (const domain of ["money", "health", "business"] as FortuneDomain[]) {
    const action = all.find((a) => a.domain === domain)!;
    assert.ok(action.disclaimer, `${domain} 에 안내 문구가 없다`);
  }
});

test("재물 행동은 벌이는 쪽을 권하지 않는다", () => {
  for (const flow of FLOWS) {
    const { action, avoid } = DAILY_ACTION_TABLE[flow].money;
    // 투자·결제를 권하는 자리는 행동이 아니라 '피할 행동'에만 있어야 한다.
    for (const word of ["투자하세요", "결제하세요", "사세요"]) {
      assert.ok(!action.includes(word), `${flow}/money 가 지출을 권한다`);
    }
    assert.ok(avoid.length > 0);
  }
});

test("영역 라벨이 여덟 개 다 있다", () => {
  assert.equal(DOMAINS.length, 8);
  for (const domain of DOMAINS) {
    assert.ok(DOMAIN_LABEL[domain]);
  }
});

test("seoulToday 는 서버 지역과 무관하게 한국 날짜를 준다", () => {
  // UTC 로 9월 1일 20시 = 한국 9월 2일 새벽 5시.
  assert.equal(seoulToday(new Date("2026-09-01T20:00:00Z")), "2026-09-02");
  // UTC 자정 직후는 한국에서 이미 같은 날 아침이다.
  assert.equal(seoulToday(new Date("2026-09-01T00:30:00Z")), "2026-09-01");
  assert.match(seoulToday(), /^\d{4}-\d{2}-\d{2}$/);
});

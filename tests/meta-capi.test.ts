import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFbc, eventTimeSeconds } from "@/lib/meta-capi";
import { purchaseEventId } from "@/lib/purchase-event-id";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("전환 시각", () => {
  it("결제를 요청한 시각을 쓴다 — 승인 시각이 아니다", () => {
    // 이체 요청 3시간 뒤에 승인이 났다. 광고 성과는 요청 시각에 붙어야 한다.
    const requested = NOW - 3 * 60 * 60 * 1000;
    assert.equal(eventTimeSeconds(requested, NOW), Math.floor(requested / 1000));
  });

  it("7일보다 오래된 것은 당겨 온다 — 그대로 보내면 Meta 가 버린다", () => {
    const tooOld = NOW - 30 * DAY;
    const sent = eventTimeSeconds(tooOld, NOW) * 1000;
    assert.ok(sent > NOW - 7 * DAY, "7일 창 안으로 들어와야 한다");
    assert.ok(sent <= NOW);
  });

  it("미래 시각은 지금으로 잡는다", () => {
    assert.equal(eventTimeSeconds(NOW + 10 * DAY, NOW), Math.floor(NOW / 1000));
  });

  it("시각이 없으면 지금", () => {
    assert.equal(eventTimeSeconds(undefined, NOW), Math.floor(NOW / 1000));
  });
});

describe("광고 클릭 식별자(fbc)", () => {
  it("쿠키가 있으면 그대로 쓴다", () => {
    assert.equal(buildFbc("fb.1.123.abc", { fbclid: "zzz", at: 999 }), "fb.1.123.abc");
  });

  it("쿠키가 막혔으면 주소에서 받아 둔 fbclid 로 만든다", () => {
    assert.equal(buildFbc(undefined, { fbclid: "abc123", at: 555 }), "fb.1.555.abc123");
  });

  it("광고 클릭이 아니면 아무것도 만들지 않는다", () => {
    assert.equal(buildFbc(undefined, null), undefined);
    assert.equal(buildFbc(undefined, { source: "naver" }), undefined);
  });
});

describe("전환 열쇠", () => {
  it("주문 번호에서 그대로 나온다 — 두 번 나가도 한 건으로 합쳐진다", () => {
    assert.equal(purchaseEventId(11), "order-11");
    assert.equal(purchaseEventId(11), purchaseEventId(11));
    assert.notEqual(purchaseEventId(11), purchaseEventId(12));
    // 포트원은 결제 번호로 가리킨다. 브라우저와 서버가 같은 값을 만들어야 한다.
    assert.equal(purchaseEventId("LRP_abc123"), "order-LRP_abc123");
  });
});

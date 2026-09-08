import assert from "node:assert/strict";
import test from "node:test";
import { FLOWS } from "../src/lib/daily-action";
import { RADAR_AXES, radarOf, radarPolygon, radarRing } from "../src/lib/today-radar";

/*
  오각형 좌표는 조용히 틀린다 — 각도가 어긋나도 도형은 그려지고, 축과 라벨이
  한 칸씩 밀려도 화면은 멀쩡해 보인다. 그래서 수학 쪽을 검사한다.
*/

test("축은 다섯이고 서로 다른 영역이다", () => {
  assert.equal(RADAR_AXES.length, 5);
  assert.equal(new Set(RADAR_AXES.map((a) => a.domain)).size, 5);
});

test("어느 흐름이든 다섯 점이 나오고 길이가 범위 안이다", () => {
  for (const flow of FLOWS) {
    const pts = radarOf(flow);
    assert.equal(pts.length, 5, `${flow} 의 점이 다섯이 아니다`);
    for (const p of pts) {
      // 0 에 가까우면 그 축이 "없다" 로 읽힌다 — 최소 길이를 지킨다
      assert.ok(p.ratio >= 0.34, `${flow}/${p.domain} 이 너무 짧다 (${p.ratio})`);
      assert.ok(p.ratio <= 1, `${flow}/${p.domain} 이 바깥으로 나갔다 (${p.ratio})`);
    }
  }
});

test("흐름마다 모양이 다르다 — 오늘이 달라지면 그림도 달라진다", () => {
  const shapes = FLOWS.map((f) => radarPolygon(radarOf(f), 220));
  assert.equal(new Set(shapes).size, FLOWS.length, "두 흐름이 같은 모양을 그린다");
});

test("그 흐름의 1순위 영역이 가장 길다", () => {
  // 순서를 길이로 옮기는 것이 이 화면의 전부다. 뒤집히면 거짓말이 된다.
  for (const flow of FLOWS) {
    const pts = radarOf(flow);
    const longest = pts.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    const others = pts.filter((p) => p !== longest);
    for (const o of others) {
      assert.ok(o.ratio <= longest.ratio, `${flow}: ${o.domain} 이 1순위보다 길다`);
    }
  }
});

test("좌표는 도형 안에 있고 숫자로 읽힌다", () => {
  const size = 220;
  for (const flow of FLOWS) {
    const pts = radarPolygon(radarOf(flow), size).split(" ");
    assert.equal(pts.length, 5);
    for (const pair of pts) {
      const [x, y] = pair.split(",").map(Number);
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `좌표가 숫자가 아니다: ${pair}`);
      assert.ok(x >= 0 && x <= size, `x 가 밖이다: ${x}`);
      assert.ok(y >= 0 && y <= size, `y 가 밖이다: ${y}`);
    }
  }
});

test("격자는 안쪽일수록 작다", () => {
  const size = 220;
  const c = size / 2;
  const radius = (ring: string) => {
    const [x, y] = ring.split(" ")[0].split(",").map(Number);
    return Math.hypot(x - c, y - c);
  };
  const outer = radius(radarRing(5, size, 1));
  const mid = radius(radarRing(5, size, 0.66));
  const inner = radius(radarRing(5, size, 0.33));
  assert.ok(inner < mid && mid < outer, `격자 크기가 뒤집혔다: ${inner} ${mid} ${outer}`);
});

test("첫 꼭짓점은 정확히 위쪽이다 — 라벨과 축이 맞아야 한다", () => {
  const size = 220;
  const [x, y] = radarRing(5, size, 1).split(" ")[0].split(",").map(Number);
  assert.ok(Math.abs(x - size / 2) < 0.5, `첫 점이 가운데 위가 아니다 (x=${x})`);
  assert.ok(y < size / 2, `첫 점이 위쪽이 아니다 (y=${y})`);
});

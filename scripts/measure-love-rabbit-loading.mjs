import puppeteer from "puppeteer-core";

import { planReadingAssets, assetSrc } from "../src/lib/reading-asset-selector.ts";

// 삽화가 실제로 얼마나 빨리 뜨는지 잰다.
//
// "이제 즉시 뜬다" 는 말은 값이 있어야 말이 된다. 리딩 한 편이 쓰는 여섯 장을
// 실제 서버에서 브라우저로 받아 보고, 세 가지를 잰다.
//
//   1. 여섯 장이 다 뜨기까지 걸린 시간
//   2. 받은 총 바이트
//   3. 재방문에서 캐시가 먹는가 (안 먹으면 매번 다시 받는다)
//
// 느린 4G 도 같이 잰다. 사무실 와이파이에서 빠른 것은 아무 말도 아니다.
//
//   node --experimental-strip-types scripts/measure-love-rabbit-loading.mjs

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:3000";

// Lighthouse 의 Slow 4G 와 같은 값
const SLOW_4G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
};

const plan = planReadingAssets({
  chapterEmotionTags: [["설렘"], ["그리움"], ["망설임"], ["균열"], ["회복"]],
  dayMasterElement: "수",
});
const urls = [...plan.scenes.map(assetSrc), assetSrc(plan.talisman)];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox"],
});

async function measure({ label, throttle, page: reuse, cold }) {
  const page = reuse ?? (await browser.newPage());
  await page.setViewport({ width: 390, height: 844 });

  const client = await page.createCDPSession();
  // 진짜 첫 방문을 재려면 캐시를 비워야 한다. 안 그러면 "빠르다" 가 아니라
  // "이미 갖고 있었다" 를 재게 된다.
  if (cold) await client.send("Network.clearBrowserCache");
  if (throttle) await client.send("Network.emulateNetworkConditions", throttle);

  // 리딩 쪽과 같은 방식으로 건다 — 여섯 장을 한꺼번에.
  await page.goto(BASE + "/favicon.ico", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 });

  const stats = await page.evaluate(async (list) => {
    performance.clearResourceTimings();
    const started = performance.now();
    await Promise.all(
      list.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = img.onerror = resolve;
            img.src = src;
          })
      )
    );
    const elapsed = performance.now() - started;
    const entries = performance.getEntriesByType("resource").filter((e) => e.name.includes("love-rabbit"));
    return {
      count: entries.length,
      total: Math.round(elapsed),
      each: entries.map((e) => Math.round(e.duration)).sort((a, b) => a - b),
      bytes: entries.reduce((sum, e) => sum + (e.transferSize || 0), 0),
      cached: entries.filter((e) => e.transferSize === 0).length,
    };
  }, urls);

  console.log(`\n[${label}]`);
  console.log(`  여섯 장 전부 뜨기까지  ${stats.total}ms`);
  console.log(`  장당                  ${stats.each.join("ms, ")}ms`);
  console.log(`  받은 바이트            ${(stats.bytes / 1024).toFixed(0)}KB`);
  console.log(`  캐시로 해결            ${stats.cached}/${stats.count}장`);
  return { page, stats };
}

const fast = await measure({ label: "1) 빠른 회선 · 첫 방문(캐시 비움)", throttle: null, cold: true });
await measure({ label: "2) 같은 브라우저 · 재방문", throttle: null, page: fast.page });
await measure({ label: "3) 느린 4G · 첫 방문(캐시 비움)", throttle: SLOW_4G, cold: true });
await measure({ label: "4) 느린 4G · 재방문", throttle: SLOW_4G });

await browser.close();

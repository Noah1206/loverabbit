import puppeteer from "puppeteer-core";

// /dev/reading-preview 에서 사전 제작 삽화가 실제로 붙는지 확인한다.
// 뷰어는 쪽 단위라 ?p=N 으로 넘겨가며 모은다.

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:3000";
const PRODUCTS = ["sokgunghap", "ibyeol", "jaehoe", "yeonae"];
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "[PASS]" : "[FAIL]"} ${name}${detail ? " - " + detail : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: "new",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 }); // 아이폰 크기 — 모바일 크롭 확인
await page.evaluateOnNewDocument(() => localStorage.setItem("loverabbit-consent-v1", "denied"));

const generationCalls = [];
page.on("request", (req) => {
  const url = req.url();
  if (/api\.openai\.com|images\/generations|generativelanguage|api\.anthropic\.com|higgsfield/i.test(url)) {
    generationCalls.push(url);
  }
});

const collect = async () => {
  return page.$$eval("img", (nodes) =>
    nodes
      .filter((n) => (n.getAttribute("src") ?? "").includes("love-rabbit"))
      .map((n) => ({ src: n.getAttribute("src"), w: n.clientWidth, h: n.clientHeight }))
  );
};

for (const product of PRODUCTS) {
  await page.goto(BASE + "/dev/reading-preview?product=" + product, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await new Promise((r) => setTimeout(r, 7000));
  const readingId = (page.url().split("/reading/")[1] ?? "").split("?")[0];

  const seen = new Set();
  let pages = 0;
  const crops = [];
  // 쪽수를 모르므로 내용이 있는 마지막 쪽까지만 간다. 넘어가면 빈 화면이라
  // 부적(마지막 쪽에서만 나온다)을 못 만난다.
  for (let p = 1; p <= 14; p += 1) {
    await page.goto(BASE + "/reading/" + readingId + "?p=" + p, { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1500));
    const len = await page.evaluate(() => document.body.innerText.length);
    if (len < 200) break;
    pages += 1;
    // 부적은 뒷면으로 덮여 있다. "부적받기" 를 눌러야 그림이 나온다.
    for (const button of await page.$$(".rv-talisman-open")) {
      const label = await button.evaluate((n) => n.textContent ?? "");
      if (label.includes("부적받기")) { await button.click().catch(() => {}); await new Promise((r) => setTimeout(r, 900)); }
    }
    for (const found of await collect()) { seen.add(found.src); crops.push(found); }
  }
  const list = [...seen];
  const scenes = list.filter((s) => s.includes("/scenes/"));
  const talismans = list.filter((s) => s.includes("/talismans/"));

  // 장이 다섯보다 적은 리딩(짧은 미리보기)도 있다. 장 수만큼 붙으면 정상이다.
  check(product + ": 장 수만큼 삽화가 붙는다", scenes.length === Math.min(5, pages), scenes.length + "장 / 장 " + pages + "개");
  check(product + ": 같은 장면이 두 번 안 쓰인다", new Set(scenes).size === scenes.length);
  check(product + ": 부적이 하나 붙는다", talismans.length === 1, talismans[0] ?? "없음");
  check(product + ": 전부 webp", list.length > 0 && list.every((s) => s.endsWith(".webp")));
  const sized = crops.filter((c) => c.w > 0 && c.h > 0);
  check(
    product + ": 모바일 폭(390) 안에 들어온다",
    sized.length > 0 && sized.every((c) => c.w <= 390),
    sized.length ? sized[0].w + "x" + sized[0].h : "측정 실패"
  );
}

check("이미지 생성 API 호출이 0이다", generationCalls.length === 0, generationCalls.join(", ") || "0건");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log("\n" + (results.length - failed) + "/" + results.length + " 통과");
process.exit(failed ? 1 : 0);

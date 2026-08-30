"use client";

// 공유 이미지 생성 — 인스타 스토리·릴스 캡처용 (ROADMAP Week 2 바이럴 루프의 엔진)
export function downloadShareImage(teaser: string) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#121215");
  bg.addColorStop(1, "#0a0a0c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#26262c";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f2f2f4";
  ctx.font = "bold 56px 'Malgun Gothic', sans-serif";
  ctx.fillText("🐰 러브레빗", W / 2, 180);
  ctx.fillStyle = "#a5a3ac";
  ctx.font = "32px 'Malgun Gothic', sans-serif";
  ctx.fillText("레빗 언니가 나한테 한 말", W / 2, 240);

  // 티저 본문 워드랩
  ctx.fillStyle = "#efe9f5";
  ctx.font = "40px 'Malgun Gothic', sans-serif";
  const maxWidth = W - 200;
  const words = teaser.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const lineHeight = 62;
  const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineHeight));

  // 따옴표 장식
  ctx.fillStyle = "#8b5cf6";
  ctx.font = "bold 120px Georgia, serif";
  ctx.fillText("“", 140, startY - 80);

  ctx.fillStyle = "#e8b84b";
  ctx.font = "bold 36px 'Malgun Gothic', sans-serif";
  ctx.fillText("너도 궁금하면 → 러브레빗", W / 2, H - 160);
  ctx.fillStyle = "#a5a3ac";
  ctx.font = "28px 'Malgun Gothic', sans-serif";
  ctx.fillText("속궁합·연애운을 섬세하게 읽는 AI 사주", W / 2, H - 110);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "loverabbit-reading.png";
  a.click();
}

/**
 * 귀인 지도 스토리 카드. 별명·역할 분포만 싣는다 — 생년월일·점수는 카드에
 * 넣지 않는다 (개인정보와 확정적 숫자 둘 다, 캡처는 어디로 갈지 모른다).
 */
export function downloadGuinShareImage(nickname: string, roleLines: string[]) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 따뜻한 아이보리 바탕 (지시문 11항의 시각 언어)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f7f1e8");
  bg.addColorStop(1, "#efe5d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#d8c9b2";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";
  ctx.fillStyle = "#3f2c22";
  ctx.font = "bold 54px 'Malgun Gothic', sans-serif";
  ctx.fillText("🐰 귀인 지도", W / 2, 190);
  ctx.font = "bold 46px 'Malgun Gothic', sans-serif";
  ctx.fillText(`${nickname}님의 인연들`, W / 2, 270);

  ctx.font = "40px 'Malgun Gothic', sans-serif";
  const startY = 430;
  roleLines.slice(0, 5).forEach((line, i) => {
    ctx.fillStyle = "#5a4433";
    ctx.fillText(line, W / 2, startY + i * 88);
  });

  ctx.fillStyle = "#8a5a2b";
  ctx.font = "bold 42px 'Malgun Gothic', sans-serif";
  ctx.fillText("너는 나에게 어떤 인연일까?", W / 2, H - 260);
  ctx.fillStyle = "#7a6a56";
  ctx.font = "30px 'Malgun Gothic', sans-serif";
  ctx.fillText("생일만 입력하면 지도에 나타나 · 러브레빗", W / 2, H - 200);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "loverabbit-guin-map.png";
  a.click();
}

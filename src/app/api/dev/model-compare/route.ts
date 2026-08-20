// 모델 비교 결과를 화면에 넘겨주는 개발 전용 경로.
//
// scripts/model-compare.mts 가 저장소 루트에 써 둔 .model-compare.json 을 읽는다.
// 그 파일에는 리딩 원문이 통째로 들어 있으므로 운영에서는 절대 열리면 안 된다.

import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FILE = ".model-compare.json";

export async function GET() {
  // 운영에서는 존재하지 않는 경로처럼 군다. 개발 도구가 배포에 딸려가도 열리지 않는다.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const target = path.join(process.cwd(), FILE);
  if (!fs.existsSync(target)) {
    return NextResponse.json(
      { error: `${FILE} 이 없어요. 먼저 "npx tsx --env-file=.env scripts/model-compare.mts --dry" 를 돌려주세요.` },
      { status: 404 }
    );
  }

  try {
    return NextResponse.json(JSON.parse(fs.readFileSync(target, "utf8")));
  } catch (e) {
    return NextResponse.json({ error: `${FILE} 을 읽지 못했어요: ${String(e)}` }, { status: 500 });
  }
}

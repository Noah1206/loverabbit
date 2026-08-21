// 생성해 둔 리딩을 화면에 넘겨주는 개발 전용 경로.
//
// scripts/reading-preview.mts 가 저장소 루트에 써 둔 .reading-preview.<상품>.json 을 읽는다.
// 그 파일에는 유료 본문이 통째로 들어 있으므로 운영에서는 절대 열리면 안 된다.
//
// ?product=sokgunghap 으로 고르고, 없으면 가장 최근에 만든 것을 준다.

import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PREFIX = ".reading-preview.";
const SUFFIX = ".json";

function listPreviews(root: string): { product: string; file: string; at: number }[] {
  return fs
    .readdirSync(root)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(SUFFIX))
    .map((name) => ({
      product: name.slice(PREFIX.length, -SUFFIX.length),
      file: path.join(root, name),
      at: fs.statSync(path.join(root, name)).mtimeMs,
    }))
    .sort((a, b) => b.at - a.at);
}

export async function GET(request: Request) {
  // 운영에서는 존재하지 않는 경로처럼 군다. 개발 도구가 배포에 딸려가도 열리지 않는다.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const root = process.cwd();
  const found = listPreviews(root);
  if (found.length === 0) {
    return NextResponse.json(
      {
        error:
          '만들어 둔 리딩이 없어요. "npx tsx --env-file=.env scripts/reading-preview.mts" 를 먼저 돌려주세요.',
      },
      { status: 404 }
    );
  }

  const wanted = new URL(request.url).searchParams.get("product");
  const picked = (wanted && found.find((f) => f.product === wanted)) || found[0];

  return NextResponse.json({
    ...JSON.parse(fs.readFileSync(picked.file, "utf8")),
    // 화면이 "지금 무엇을 보고 있고 무엇이 더 있는지" 를 알 수 있게 함께 준다
    product: picked.product,
    available: found.map((f) => f.product),
  });
}

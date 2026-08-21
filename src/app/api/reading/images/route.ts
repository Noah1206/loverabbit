// 리딩 삽화 — 상태를 묻고, 작업을 시작시킨다.
//
// GET  ?readingId=...   지금 어디까지 됐는지. 화면이 이걸 주기적으로 묻는다.
// POST { readingId }    아직 안 만들었으면 시작한다. 응답은 기다리지 않는다.
//
// 소유 확인: 그림 주소는 리딩을 산 사람만 볼 수 있어야 한다. 리딩 자체가
// 봉인 blob 과 보관함으로 다니므로, 여기서는 **그 리딩이 해금됐는지**만 본다.
// 해금되지 않은 리딩의 그림은 애초에 만들지 않는다.

import { NextResponse } from "next/server";
import { loadImageState } from "@/lib/reading-image-store";
import { waitUntil } from "@vercel/functions";

import { runImageJob } from "@/lib/reading-image-job";
import { pickIllustrated, TALISMAN_SLOT } from "@/lib/reading-images";
import { loadResume } from "@/lib/reading-resume";
import { getReading } from "@/lib/store";
import { buildChapters } from "@/lib/reading-chapters";
import { parseReportSections } from "@/lib/reading-report";
import { conceptFor } from "@/lib/reading-concepts";
import { PRODUCT_MAP } from "@/lib/products";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 개발의 미리보기 하네스만 쓰는 id. 운영에서는 통하지 않는다. */
function readable(id: string): boolean {
  return UUID.test(id) || (process.env.NODE_ENV !== "production" && /^preview-[a-z0-9]{1,20}$/.test(id));
}

// 그림은 다섯 장에 장당 수십 초다. 기본 한도로는 waitUntil 이 붙들어도 모자란다.
export const maxDuration = 300;

export async function GET(request: Request) {
  const readingId = new URL(request.url).searchParams.get("readingId") ?? "";
  if (!readable(readingId)) return NextResponse.json({ images: [] });
  try {
    return NextResponse.json({ images: (await loadImageState(readingId)) ?? [] });
  } catch (e) {
    console.error("그림 상태 조회 실패:", e);
    return NextResponse.json({ images: [] });
  }
}

export async function POST(request: Request) {
  let body: { readingId?: string };
  try {
    body = (await request.json()) as { readingId?: string };
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const readingId = body.readingId ?? "";
  if (!UUID.test(readingId)) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });

  const stored = await getReading(readingId);
  // 해금되지 않은 리딩에는 그림을 만들지 않는다. 한 장에 돈이 든다.
  if (!stored?.unlocked) return NextResponse.json({ images: [] });

  // 이미 시작했으면 그대로 둔다 — 두 번 부르면 돈이 두 배로 나간다
  const existing = await loadImageState(readingId);
  if (existing && existing.length > 0) return NextResponse.json({ images: existing });

  // 서버에는 구조화 리포트가 없다 — 그건 봉인 blob 을 통해 클라이언트가 들고 있다.
  // 저장된 전문을 뷰어와 **같은 방식으로** 파싱해 장을 세운다. 두 곳이 다르게 세우면
  // 그림이 엉뚱한 장에 붙는다.
  const sections = parseReportSections(stored.full ?? "");
  if (sections.length === 0) return NextResponse.json({ images: [] });

  const product = PRODUCT_MAP[stored.category ?? ""];
  const concept = conceptFor(stored.category);
  const chapters = buildChapters(
    sections.map((section) => ({ title: section.title, paragraphs: section.paragraphs })),
    {
      toc: product?.toc ?? sections.map((section) => section.title),
      chapterTitles: concept.chapters,
      epilogueTitle: concept.epilogue,
    }
  ).map((chapter) => ({
    chapter: chapter.number,
    title: chapter.title,
    gist: chapter.sections[0]?.paragraphs[0] ?? chapter.title,
  }));

  const resume = await loadResume(readingId).catch(() => null);

  // 곧바로 응답하되, 작업은 waitUntil 로 함수 수명에 묶는다.
  //
  // void 로 던지면 로컬에서는 돌지만 Vercel 서버리스에서는 응답을 돌려주는
  // 순간 함수가 얼어 작업이 죽는다. 그러면 상태가 pending 인 채 영영 남고,
  // 화면은 오지 않을 그림 자리를 계속 비워 둔다 - 실제로 그랬다.
  const job = runImageJob({
    readingId,
    chapters,
    occupation: resume?.occupation,
    question: resume?.currentScene,
    chart: stored.chart?.me,
    label: product?.shortLabel ?? product?.title,
  });
  try {
    waitUntil(job);
  } catch {
    // Vercel 요청 컨텍스트 밖(로컬 next start 등)에서는 그냥 백그라운드로 돈다.
    void job;
  }

  // 화면이 어느 장에 그림이 오는지 알아야 그 자리에만 틀을 깐다.
  // 그림 없는 장에 틀을 깔면 오지 않을 것을 기다리게 된다.
  return NextResponse.json({
    images: [
      ...pickIllustrated(chapters).map((c) => ({ chapter: c.chapter, status: "pending" })),
      { chapter: TALISMAN_SLOT, status: "pending" },
    ],
  });
}

// 리딩 삽화 — 상태를 묻고, 작업을 시작시킨다.
//
// GET  ?readingId=...   지금 어디까지 됐는지. 화면이 이걸 주기적으로 묻는다.
// POST { readingId }    아직 정해지지 않았으면 사전 제작 에셋에서 골라 정한다.
//
// 소유 확인: 그림 주소는 리딩을 산 사람만 볼 수 있어야 한다. 리딩 자체가
// 봉인 blob 과 보관함으로 다니므로, 여기서는 **그 리딩이 해금됐는지**만 본다.
// 해금되지 않은 리딩의 그림은 애초에 만들지 않는다.

import { NextResponse } from "next/server";
import { loadImageState, saveImageState } from "@/lib/reading-image-store";

import { pickIllustrated } from "@/lib/reading-images";
import { planImagesFor } from "@/lib/reading-asset-plan";
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
  if (!readable(readingId)) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });

  const stored = await getReading(readingId);
  // 해금된 리딩만. 그림 주소는 리딩을 산 사람만 볼 수 있어야 한다.
  //
  // 저장소에 없는 id 는 개발 미리보기(preview-*)뿐이다 - readable() 이 운영에서는
  // 그 모양을 통과시키지 않는다. 그 경우 태그 없이 컷 위치 기본값으로만 고른다.
  const preview = !stored && !UUID.test(readingId);
  if (!preview && !stored?.unlocked) return NextResponse.json({ images: [] });

  // 이미 시작했으면 그대로 둔다 — 두 번 부르면 돈이 두 배로 나간다
  const existing = preview ? null : await loadImageState(readingId);
  if (existing && existing.length > 0) return NextResponse.json({ images: existing });

  // 서버에는 구조화 리포트가 없다 — 그건 봉인 blob 을 통해 클라이언트가 들고 있다.
  // 저장된 전문을 뷰어와 **같은 방식으로** 파싱해 장을 세운다. 두 곳이 다르게 세우면
  // 그림이 엉뚱한 장에 붙는다.
  const sections = parseReportSections(stored?.full ?? "");
  if (sections.length === 0 && !preview) return NextResponse.json({ images: [] });

  const product = PRODUCT_MAP[stored?.category ?? ""];
  const concept = conceptFor(stored?.category);
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

  // 그림은 만들지 않고 고른다. 사전 제작 에셋을 감정 태그 x 컷 위치 x 일간 오행으로
  // 꺼내 쓴다 - 이 경로에서 이미지 생성 API 는 한 번도 부르지 않는다.
  //
  // 발급 때 이미 정해 두므로 보통 위에서 끝난다. 여기까지 오는 것은 발급이
  // 계획 저장 전에 있었던 옛 리딩뿐이고, 그 경우 태그가 없으니 컷 위치의
  // 기본값(설렘·망설임·균열·결심·회복)으로 고른다.
  const images = planImagesFor({
    chapterNumbers: chapters.length > 0 ? pickIllustrated(chapters).map((c) => c.chapter) : [1, 2, 3, 4, 5],
    chapterEmotionTags: [],
    chart: stored?.chart?.me,
    label: product?.shortLabel ?? product?.title,
  });

  // 미리보기 id 는 저장소에 넣지 않는다. lr_readings 의 id 는 uuid 라 들어가지 않고,
  // 개발 하네스 때문에 운영 테이블 모양을 바꿀 이유도 없다.
  if (!preview) {
    try {
      await saveImageState(readingId, images);
    } catch (e) {
      console.error("삽화 상태 저장 실패:", e);
    }
  }

  return NextResponse.json({ images });
}

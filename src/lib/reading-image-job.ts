// 그림을 뒤에서 만드는 일꾼.
//
// 한 장에 60초다. 다섯 장이면 5분이고, 그동안 사용자는 이미 글을 읽고 있다.
// 그래서 이 함수는 **아무도 기다리지 않는다** — 부르는 쪽은 await 하지 않고 던져 두고,
// 여기서는 한 장씩 만들어 끝나는 대로 상태판에 적는다.
//
// 순서대로 만드는 이유: 1장을 읽는 동안 1장 그림이 먼저 도착해야 한다.
// 동시에 던지면 다섯 장이 동시에 늦게 도착하고, 읽는 순서와 어긋난다.
//
// 실패는 흔한 일로 본다. 한 장이 안 나와도 다음 장을 계속 만들고, 다 실패해도
// 리딩은 온전하다. 그림은 덤이지 본문이 아니다.

import {
  renderImage,
  writeImagePrompts,
  pickIllustrated,
  TALISMAN_SLOT,
  type ChapterBrief,
  type ReadingImage,
} from "@/lib/reading-images";
import { planTalisman } from "@/lib/reading-talisman";
import { markImage, putImage, saveImageState } from "@/lib/reading-image-store";

export interface ImageJobInput {
  readingId: string;
  chapters: ChapterBrief[];
  occupation?: string;
  question?: string;
  /** "임신 계축 을사 계미" — 부적의 결을 정하는 일간이 여기서 나온다 */
  chart?: string;
  /** 상품 이름. 부적의 대체 텍스트에 쓴다 */
  label?: string;
}

/**
 * 이 리딩의 그림을 처음부터 끝까지 만든다.
 *
 * **await 하지 말 것.** 5분이 걸리고, 부르는 쪽은 응답을 이미 보냈어야 한다.
 */
export async function runImageJob({
  readingId,
  chapters: allChapters,
  occupation,
  question,
  chart,
  label,
}: ImageJobInput): Promise<void> {
  // 장이 많은 상품은 한 장 걸러 하나씩. 장수를 고정해 값이 상품마다 튀지 않게 한다.
  const chapters = pickIllustrated(allChapters);
  if (chapters.length === 0) return;

  try {
    // 먼저 자리를 잡아 둔다 — 화면이 "몇 장이 오는 중인지" 를 알아야 틀을 그린다.
    const pending: ReadingImage[] = chapters.map((c) => ({ chapter: c.chapter, status: "pending" }));
    // 부적도 자리를 잡아 둔다. 마지막 장에서 "부적받기" 를 누를 때까지 기다리게 하지 않고,
    // 글을 읽는 동안 뒤에서 미리 그려 둔다 — 다 읽고 눌렀을 때 이미 있어야 선물이 된다.
    if (chart) pending.push({ chapter: TALISMAN_SLOT, status: "pending" });
    await saveImageState(readingId, pending);

    const prompts = await writeImagePrompts(chapters, { occupation, question });
    if (prompts.length === 0) {
      // 지시문을 못 썼거나 전부 선에 걸렸다. 자리를 비우고 끝낸다.
      await saveImageState(
        readingId,
        chapters.map((c) => ({ chapter: c.chapter, status: "failed" as const }))
      );
      return;
    }

    // 지시문이 안 나온 장은 기다리게 두지 않는다
    const has = new Set(prompts.map((p) => p.chapter));
    for (const c of chapters) {
      if (!has.has(c.chapter)) await markImage(readingId, c.chapter, { status: "failed" });
    }

    /*
      생성은 병렬, 기록은 직렬 (2026-08-22 운영자 방향: 읽는 동안 준비되는
      순서대로 결합).

      - 병렬: 장당 수십 초짜리를 다섯 장 직렬로 돌리면 5분이다. 동시에 세 장씩
        그리면 첫 그림이 1분 안에 붙기 시작하고, 전체도 2분 안에 끝난다.
        셋인 것은 이미지 API 의 분당 한도를 넘지 않는 선이다.
      - 직렬 기록: markImage 는 전체 배열을 읽고-고쳐-쓴다. 두 완료가 겹치면
        한쪽 기록이 사라져 그 장이 pending 인 채 영영 남는다. 그래서 그리는
        것은 겹치되 적는 것은 한 줄로 세운다.

      부적은 대기열 맨 뒤다. 장 그림이 먼저 붙어야 읽는 순서와 맞는다.
    */
    type ImageTask = { chapter: number; prompt: string; alt?: string; kind: "scene" | "talisman" };
    const tasks: ImageTask[] = prompts
      .sort((a, b) => a.chapter - b.chapter)
      .map((p) => ({ chapter: p.chapter, prompt: p.prompt, alt: p.alt, kind: "scene" as const }));
    if (chart) {
      const plan = planTalisman(chart, label ?? "이 리딩");
      tasks.push({ chapter: TALISMAN_SLOT, prompt: plan.prompt, alt: plan.alt, kind: "talisman" });
    }

    let markChain: Promise<void> = Promise.resolve();
    const mark = (chapter: number, patch: { status: "ready" | "failed"; url?: string; alt?: string }) => {
      markChain = markChain
        .then(() => markImage(readingId, chapter, patch))
        .catch((e) => console.warn("그림 상태 기록 실패:", String(e).slice(0, 120)));
      return markChain;
    };

    const queue = [...tasks];
    const CONCURRENCY = 3;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (;;) {
          const task = queue.shift();
          if (!task) return;
          const bytes = await renderImage(task.prompt, task.kind);
          if (!bytes) {
            await mark(task.chapter, { status: "failed" });
            continue;
          }
          const url = await putImage(readingId, task.chapter, bytes);
          await mark(task.chapter, url ? { status: "ready", url, alt: task.alt } : { status: "failed" });
        }
      })
    );
  } catch (e) {
    // 여기까지 온 오류는 그림만의 문제다. 리딩은 이미 팔렸고 이미 읽히고 있다.
    console.error(`리딩 ${readingId} 그림 작업 실패:`, String(e).slice(0, 300));
  }
}

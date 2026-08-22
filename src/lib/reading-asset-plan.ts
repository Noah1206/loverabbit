import { dayStemOf, elementOfStem } from "@/lib/reading-talisman";
import {
  assetSrc,
  planReadingAssets,
  type DayMasterElement,
  type EmotionTag,
} from "@/lib/reading-asset-selector";
import { TALISMAN_SLOT, type ReadingImage } from "@/lib/reading-image-shape";

// 리딩 한 편의 삽화를 "고른" 결과를 화면이 쓰는 모양으로 옮긴다.
//
// 화면(ReadingChapters)은 이미 ReadingImage[] 를 그린다. 그림을 만들던 시절의
// 모양 그대로 쓰면 화면을 고칠 일이 없다 - 다만 status 가 처음부터 ready 다.
// 기다릴 것이 없기 때문이다.

/** 5컷이 앉을 장 번호. 실제 장 번호를 넘겨받아 순서대로 짝짓는다. */
export function planImagesFor(input: {
  chapterNumbers: readonly number[];
  chapterEmotionTags: readonly (readonly EmotionTag[] | readonly string[] | undefined)[];
  /** 본인 명식 문자열 (StoredReading.chart.me) */
  chart?: string | null;
  label?: string;
}): ReadingImage[] {
  const element = elementFromChart(input.chart);
  const plan = planReadingAssets({
    chapterEmotionTags: input.chapterEmotionTags.map((tags) => tags ?? []),
    dayMasterElement: element,
  });

  const images: ReadingImage[] = plan.scenes.slice(0, input.chapterNumbers.length).map((scene, index) => ({
    chapter: input.chapterNumbers[index],
    status: "ready",
    url: assetSrc(scene),
    alt: altForScene(scene.emotionTag),
  }));

  images.push({
    chapter: TALISMAN_SLOT,
    status: "ready",
    url: assetSrc(plan.talisman),
    alt: `${input.label ?? "이 리딩"} 부적 — ${plan.talisman.element ?? "토"}의 기운을 담은 문양`,
  });

  return images;
}

/** 명식 문자열에서 일간 오행을 뽑는다. 못 읽으면 토 — 중앙이라 어느 쪽에도 치우치지 않는다. */
export function elementFromChart(chart?: string | null): DayMasterElement {
  if (!chart) return "토";
  const stem = dayStemOf(chart);
  return stem ? elementOfStem(stem) : "토";
}

// 낭독기가 읽을 한 줄. 그림이 무엇인지만 말한다 - 사연을 다시 말하지 않는다.
const ALT: Record<EmotionTag, string> = {
  설렘: "이른 저녁, 불빛이 번지는 창가",
  기다림: "사람 없는 밤 정류장",
  망설임: "반쯤 열린 문과 복도의 불빛",
  끌림: "늦은 밤 골목의 네온",
  흔들림: "달리는 창밖으로 흐르는 불빛",
  균열: "한쪽만 불이 켜진 방",
  단절: "새벽 거리의 빈 자리",
  그리움: "빗물이 흐르는 창",
  결심: "계단 위로 열린 문",
  회복: "옅은 아침빛이 든 거리",
};

function altForScene(tag?: EmotionTag): string {
  return tag ? ALT[tag] : "리딩 삽화";
}

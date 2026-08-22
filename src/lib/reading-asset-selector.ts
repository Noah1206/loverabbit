import assetManifest from "@/data/love-rabbit-assets.json";

// 사전 제작 에셋 선택기 — 러브레빗 삽화는 이제 만들지 않고 고른다.
//
// 리딩이 열릴 때마다 그림을 새로 그리면 한 건에 $0.35 가 나가고, 분 단위로 늦게
// 붙어서 화면이 빈자리를 띄운 채 기다린다. 감정 태그 × 컷 위치 × 일간 오행으로
// 미리 그려 둔 것을 꺼내면 값이 0 이고 즉시 뜬다.
//
// 원본은 love_rabbit_prebuilt_assets 에서 왔고 매니페스트가 기준 데이터다.
// 매니페스트의 path 는 원본 PNG 를 가리킨다. 화면에는 같은 이름의 webp 를 낸다 -
// 원본은 장당 1MB 라 여섯 장이면 6MB 다 (scripts/optimize-love-rabbit-assets.mjs).

export type ReadingSlot = 1 | 2 | 3 | 4 | 5;

export type DayMasterElement =
  | "목" | "화" | "토" | "금" | "수"
  | "wood" | "fire" | "earth" | "metal" | "water";

export const EMOTION_TAGS = [
  "설렘",
  "기다림",
  "망설임",
  "끌림",
  "흔들림",
  "균열",
  "단절",
  "그리움",
  "결심",
  "회복",
  // 운영자가 연 결 (2026-08-22). 슬픔을 빈자리로만 말하지 않고 직접 그린다.
  // 그림이 아직 없으면 컷 위치 기본값으로 떨어지므로 화면은 깨지지 않는다.
  "눈물",
] as const;

export type EmotionTag = (typeof EMOTION_TAGS)[number];

export type ReadingAsset = {
  assetId: string;
  kind: "scene" | "talisman";
  path: string;
  emotionTag?: EmotionTag;
  brightness?: "dark" | "mid" | "bright";
  element?: "목" | "화" | "토" | "금" | "수";
};

const assets = assetManifest.assets as ReadingAsset[];

/** public 아래 어디에 있는지. 매니페스트는 원본 PNG 를 가리키므로 화면용 webp 로 바꾼다. */
export function assetSrc(asset: Pick<ReadingAsset, "path">): string {
  return `/assets/love-rabbit/${asset.path.replace(/\.png$/, ".webp")}`;
}

/**
 * 제품의 5컷 흐름을 감정 곡선에 맞춘다.
 * 1: 현재 상황, 2: 흐름의 뿌리, 3: 갈림길, 4: 가장 강한 지점, 5: 다음 장면.
 */
const SLOT_BRIGHTNESS: Record<ReadingSlot, "dark" | "mid" | "bright"> = {
  1: "mid",
  2: "dark",
  3: "dark",
  4: "mid",
  5: "bright",
};

const FALLBACK_EMOTION: Record<ReadingSlot, EmotionTag> = {
  1: "설렘",
  2: "망설임",
  3: "균열",
  4: "결심",
  5: "회복",
};

const ELEMENT_TO_KOREAN: Record<DayMasterElement, "목" | "화" | "토" | "금" | "수"> = {
  목: "목",
  화: "화",
  토: "토",
  금: "금",
  수: "수",
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
};

const VALID = new Set<string>(EMOTION_TAGS);

export function isEmotionTag(value: unknown): value is EmotionTag {
  return typeof value === "string" && VALID.has(value);
}

/**
 * 허용된 태그만 남긴다.
 *
 * 모델이 뭘 뱉든 여기서 걸러진다. 목록에 없는 말은 그림을 고르지 못한다 -
 * 자해·폭력·병원 같은 말이 태그로 올라와도 에셋에 닿을 길이 없다.
 */
export function normalizeEmotionTags(tags: readonly unknown[]): EmotionTag[] {
  return [...new Set(tags.filter(isEmotionTag))];
}

export function selectSceneAsset(input: {
  slot: ReadingSlot;
  emotionTags: readonly unknown[];
  usedAssetIds?: readonly string[];
}): ReadingAsset {
  const brightness = SLOT_BRIGHTNESS[input.slot];
  const knownTags = normalizeEmotionTags(input.emotionTags);
  const used = new Set(input.usedAssetIds ?? []);
  const scenes = assets.filter((asset) => asset.kind === "scene");

  const candidates = [
    ...knownTags.flatMap((tag) =>
      scenes.filter((asset) => asset.emotionTag === tag && asset.brightness === brightness)
    ),
    ...knownTags.flatMap((tag) => scenes.filter((asset) => asset.emotionTag === tag)),
    ...scenes.filter(
      (asset) => asset.emotionTag === FALLBACK_EMOTION[input.slot] && asset.brightness === brightness
    ),
    ...scenes.filter((asset) => asset.emotionTag === FALLBACK_EMOTION[input.slot]),
  ];

  return candidates.find((asset) => !used.has(asset.assetId)) ?? candidates[0];
}

/** 일간 오행으로 부적을 고른다. 모르는 오행이면 토 — 중앙이라 어느 쪽에도 치우치지 않는다. */
export function selectTalismanAsset(dayMasterElement: DayMasterElement | null | undefined): ReadingAsset {
  const element = ELEMENT_TO_KOREAN[(dayMasterElement ?? "토") as DayMasterElement] ?? "토";
  const talisman = assets.find((asset) => asset.kind === "talisman" && asset.element === element);
  if (talisman) return talisman;
  const anyTalisman = assets.find((asset) => asset.kind === "talisman");
  if (!anyTalisman) throw new Error("부적 에셋이 하나도 없습니다.");
  return anyTalisman;
}

export interface ReadingAssetPlan {
  scenes: Array<ReadingAsset & { slot: ReadingSlot }>;
  talisman: ReadingAsset;
}

/**
 * 리딩 한 편에 필요한 5개 장면과 1개 부적을 한 번에 고른다.
 *
 * 한 리딩 안에서 같은 그림을 두 번 쓰지 않는다. 다른 사람이 같은 그림을 봐도
 * 되는 것이 사전 제작 방식의 전제다.
 */
export function planReadingAssets(input: {
  chapterEmotionTags: readonly (readonly unknown[])[];
  dayMasterElement: DayMasterElement | null | undefined;
}): ReadingAssetPlan {
  const usedAssetIds: string[] = [];
  const scenes = ([1, 2, 3, 4, 5] as const).map((slot, index) => {
    const scene = selectSceneAsset({
      slot,
      emotionTags: input.chapterEmotionTags[index] ?? [],
      usedAssetIds,
    });
    usedAssetIds.push(scene.assetId);
    return { slot, ...scene };
  });

  return { scenes, talisman: selectTalismanAsset(input.dayMasterElement) };
}

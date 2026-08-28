// 세트 상품.
//
// 재구매가 1/28 인 규모(2026-08-28)에서는 세 번 사게 만드는 것보다 한 번에 셋을
// 파는 쪽이 현실적이다. 세트는 새 리딩 종류가 아니다 — 첫 리딩(first)을 세트
// 값으로 사면, 나머지 리딩을 0원에 여는 쿠폰(bundle)이 그 자리에서 나간다.
//
// 세트인지는 리딩의 값으로 안다. 세트 값은 어느 단품 정가와도 다르고 광고
// 오퍼와도 다르므로, category + price 조합이 곧 세트 표시다. 별도 컬럼을 두지
// 않은 이유는 그것뿐이다 — 값이 겹치게 바꾸면 이 판별이 깨진다 (테스트가 지킨다).

import { PRODUCT_MAP } from "@/lib/products";

export interface Bundle {
  id: string;
  title: string;
  emoji: string;
  price: number;
  /** 세트 값으로 실제 결제되는 리딩. 나머지는 쿠폰으로 연다. */
  first: string;
  /** 세트에 든 리딩 전부 (first 포함). */
  items: string[];
  copy: string;
}

export const BUNDLES: Bundle[] = [
  {
    id: "love3",
    title: "연애 3종 세트",
    emoji: "💝",
    price: 19900,
    first: "yeonae",
    items: ["yeonae", "sokgunghap", "jaehoe"],
    copy: "올해의 연애운으로 큰 흐름을 보고, 속궁합으로 그 사람과의 결을, 재회 사주로 돌아올 자리까지. 세 장을 한 번에.",
  },
];

export const BUNDLE_MAP: Record<string, Bundle> = Object.fromEntries(BUNDLES.map((b) => [b.id, b]));

/** 단품으로 샀을 때의 합. 세트 페이지의 취소선 값. */
export function bundleListPrice(bundle: Bundle): number {
  return bundle.items.reduce((sum, id) => sum + (PRODUCT_MAP[id]?.price ?? 0), 0);
}

/** 이 카테고리를 이 세트로 시작할 수 있는가. 세트의 first 만 세트 값으로 만든다. */
export function resolveBundle(category: string, bundleId: string | null | undefined): Bundle | null {
  if (!bundleId) return null;
  const bundle = BUNDLE_MAP[bundleId];
  return bundle && bundle.first === category ? bundle : null;
}

/** 저장된 리딩이 세트 리딩인가 — category + price 로 판별한다. */
export function bundleOfReading(category: string, price: number): Bundle | null {
  return BUNDLES.find((b) => b.first === category && b.price === price) ?? null;
}

/** 세트를 사면 열리는 나머지 리딩 (쿠폰 장수). */
export function bundleRest(bundle: Bundle): string[] {
  return bundle.items.filter((id) => id !== bundle.first);
}

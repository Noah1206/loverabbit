import { hasPaidReadingOrder } from "@/lib/database";
import { PRODUCT_MAP } from "@/lib/products";
import { claimReading, type StoredReading } from "@/lib/store";

/**
 * 결제를 시작하기 직전, 리딩을 결제하는 계정에 붙인다.
 *
 * 무료 미리보기는 로그인 없이 만들어지므로(2026-08-25) 리딩이 주인 없이 올 수
 * 있다. 주문이 생기는 모든 길(계좌이체·포트원·토스·checkout)이 이걸 먼저
 * 부른다 - 계좌이체 승인 RPC 는 user_id 를 안 건드려서, 여기서 안 붙이면
 * 입금 승인 뒤 다른 기기에서 "내 리딩"에 없다.
 *
 * 광고 오퍼 자격도 여기서 한 번 더 본다. /api/reading 은 익명이면 첫 구매
 * 여부를 알 수 없어 오퍼를 그대로 살려 두는데, 그러면 이미 산 사람이
 * 로그아웃하고 광고 링크로 1,900원짜리를 또 만들 수 있다. 붙이는 순간 계정을
 * 아니까 그때 막는다. 값을 몰래 정가로 바꾸지는 않는다 - 화면에 1,900원을 보고
 * 온 사람에게 다른 금액을 청구하는 쪽이 더 나쁘다. 말하고 돌려보낸다.
 *
 * 이미 주인이 있는 리딩은 손대지 않는다. "주인이 있으면 나여야 한다"는
 * 호출부가 먼저 검사한다.
 */
export async function claimReadingForPayment(
  stored: StoredReading | null,
  userId: number
): Promise<{ error: string; status: number } | null> {
  if (!stored || stored.userId) return null;

  const listPrice = PRODUCT_MAP[stored.category]?.price;
  const offerPriced = typeof listPrice === "number" && stored.price < listPrice;
  if (offerPriced) {
    try {
      if (await hasPaidReadingOrder(userId)) {
        return {
          error: "광고 할인은 첫 구매에만 적용돼요. 로그인한 상태에서 리딩을 다시 만들어 주세요.",
          status: 409,
        };
      }
    } catch (error) {
      // 확인이 안 되면 오퍼를 살려 둔다 - /api/reading 과 같은 규칙.
      console.error("오퍼 자격 확인 실패(할인 유지):", error);
    }
  }

  try {
    await claimReading(stored.id, userId);
  } catch (error) {
    console.error("리딩 귀속 실패:", error);
    return { error: "리딩을 계정에 연결하지 못했어요. 잠시 후 다시 시도해주세요.", status: 503 };
  }
  return null;
}

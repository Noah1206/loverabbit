import { NextRequest, NextResponse } from "next/server";

import { PRODUCT_MAP } from "@/lib/products";
import { getReading, listReadingsByUser, markReadingViewed } from "@/lib/store";
import { resolveUserToken } from "@/lib/tokens";

// 내 리딩 — 계정으로 묶인 리딩을 기기와 무관하게 돌려준다.
//
// 보관함(localStorage)은 기기 하나에 갇힌다. 폰으로 결제한 사람이 PC 에서 열거나
// 브라우저 데이터를 지우면 돈 낸 리딩이 "찾을 수 없음"이 됐다. 여기가 그 구멍을
// 메운다 — 목록(/my)과 단건 복원(/reading/[id]) 둘 다 이 라우트를 쓴다.
//
// **전문(full)은 여기서 절대 나가지 않는다.** 단건 응답에도 없다. 전문은 해금
// 검증을 거치는 /api/unlock 한 곳으로만 나간다 — 화면은 unlocked 를 보고
// 그쪽을 한 번 더 부른다. 내려주는 길이 둘이면 그중 하나는 검증을 건너뛴다.

interface Body {
  userToken?: string;
  /** 있으면 단건 조회 (기기 이동 복원용) */
  readingId?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;

  let user;
  try {
    user = await resolveUserToken(body.userToken);
  } catch (error) {
    console.error("내 리딩 회원 확인 실패:", error);
    return NextResponse.json({ error: "회원 정보를 확인하지 못했어요." }, { status: 503 });
  }
  if (!user?.userId) {
    return NextResponse.json({ error: "로그인하면 내 리딩을 볼 수 있어요." }, { status: 401 });
  }

  const noStore = { "Cache-Control": "private, no-store, max-age=0" };

  try {
    if (body.readingId) {
      const reading = await getReading(body.readingId.trim());
      // 없는 것과 남의 것을 같은 404 로 답한다 — 리딩 id 로 존재 여부를 캐게 두지 않는다.
      if (!reading || reading.userId !== user.userId) {
        return NextResponse.json({ error: "리딩을 찾을 수 없어요." }, { status: 404, headers: noStore });
      }
      // 단건 조회 = 리딩 화면이 열렸다는 뜻이다. 화면은 이 응답으로 그려진다.
      // 전문 열람은 /api/unlock 이 따로 센다 — 여기에서는 티저까지만 나간다.
      void markReadingViewed(reading.id);

      return NextResponse.json(
        {
          reading: {
            readingId: reading.id,
            category: reading.category,
            label: PRODUCT_MAP[reading.category]?.shortLabel ?? reading.category,
            teaser: reading.teaser,
            chart: reading.chart,
            price: reading.price,
            scoreLabel: reading.scoreLabel ?? null,
            unlocked: reading.unlocked,
            createdAt: reading.createdAt,
          },
        },
        { headers: noStore }
      );
    }

    const rows = await listReadingsByUser(user.userId);
    return NextResponse.json(
      {
        readings: rows.map((row) => ({
          readingId: row.id,
          category: row.category,
          label: PRODUCT_MAP[row.category]?.shortLabel ?? row.category,
          teaser: row.teaser,
          price: row.price,
          unlocked: row.unlocked,
          createdAt: row.createdAt,
        })),
      },
      { headers: noStore }
    );
  } catch (error) {
    console.error("내 리딩 조회 실패:", error);
    return NextResponse.json({ error: "내 리딩을 불러오지 못했어요." }, { status: 503 });
  }
}

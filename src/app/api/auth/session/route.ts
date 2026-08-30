import { NextRequest, NextResponse } from "next/server";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { seal } from "@/lib/crypto";
import {
  getDatabaseUserByAuthId,
  getDatabaseUserByEmail,
  isDatabaseConfigured,
  linkDatabaseUserAuth,
  REFERRAL_COUPON_REWARD,
  signupDatabaseUser,
  type DatabaseAuthProvider,
  type DatabaseSocialUser,
  type ReferralRewardType,
} from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserToken } from "@/lib/tokens";

function normalizeProvider(value: unknown): DatabaseAuthProvider | null {
  if (value === "google" || value === "kakao" || value === "x") return value;
  // Older GoTrue metadata can still use the historical provider name.
  return value === "twitter" ? "x" : null;
}

function normalizeReward(value: unknown): ReferralRewardType | undefined {
  return value === REFERRAL_COUPON_REWARD ? value : undefined;
}

function sessionResponse(
  user: DatabaseSocialUser,
  provider: DatabaseAuthProvider,
  referralClaimed = false,
  // 이번 요청에서 회원 행이 새로 생겼는가. 가입 완료 화면이 이걸 보고 처음 온
  // 사람을 충전함으로 보낸다 (무료 크레딧이 없어서 그냥 두면 아무것도 못 한다).
  isNewUser = false
) {
  const token = seal({
    type: "user",
    email: user.email,
    birthdate: user.birthdate,
    iat: Date.now(),
    userId: user.id,
  } satisfies UserToken);
  return NextResponse.json({
    token,
    email: user.email,
    referralCode: user.referralCode,
    referralClaimed,
    authProvider: provider,
    isNewUser,
  });
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "회원 DB 연결을 준비 중입니다." }, { status: 503 });
  }

  let authUser: SupabaseAuthUser;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: "로그인 세션이 만료됐어요. 다시 로그인해주세요." }, { status: 401 });
    }
    authUser = data.user;
  } catch (error) {
    console.error("Supabase Auth 세션 확인 실패:", error);
    return NextResponse.json({ error: "로그인 세션을 확인하지 못했어요." }, { status: 503 });
  }

  const provider = normalizeProvider(authUser.app_metadata?.provider);
  const email = authUser.email?.trim().toLowerCase();
  if (!provider || !email) {
    return NextResponse.json(
      { error: "이메일 제공 동의가 필요해요. 로그인 제공자 설정에서 이메일 동의를 허용해주세요." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    termsAccepted?: boolean;
    marketingOk?: boolean;
    referralCode?: string;
    referralReadingId?: string;
    referralReward?: ReferralRewardType;
  };

  try {
    const linked = await getDatabaseUserByAuthId(authUser.id);
    if (linked) {
      const refreshed = await linkDatabaseUserAuth(linked.id, authUser.id, provider);
      return sessionResponse(refreshed ?? linked, provider);
    }

    const existing = await getDatabaseUserByEmail(email);
    if (existing) {
      if (existing.authUserId && existing.authUserId !== authUser.id) {
        return NextResponse.json(
          { error: "이 이메일은 다른 로그인 계정에 연결되어 있어요." },
          { status: 409 }
        );
      }
      const connected = await linkDatabaseUserAuth(existing.id, authUser.id, provider);
      if (!connected) {
        return NextResponse.json({ error: "계정을 안전하게 연결하지 못했어요." }, { status: 409 });
      }
      return sessionResponse(connected, provider);
    }

    if (body.termsAccepted !== true) {
      return NextResponse.json({ needsProfile: true, email, authProvider: provider });
    }

    const signup = await signupDatabaseUser({
      email,
      birthdate: null,
      marketingConsent: body.marketingOk === true,
      referralCode: body.referralCode,
      referralReadingId: body.referralReadingId,
      referralReward: normalizeReward(body.referralReward),
    });
    if (!signup) {
      return NextResponse.json({ error: "회원 정보를 만들지 못했어요." }, { status: 503 });
    }
    const connected = await linkDatabaseUserAuth(signup.id, authUser.id, provider);
    if (!connected) {
      return NextResponse.json({ error: "계정을 안전하게 연결하지 못했어요." }, { status: 409 });
    }
    return sessionResponse(connected, provider, signup.referralClaimed, signup.isNew);
  } catch (error) {
    console.error("소셜 로그인 회원 연결 실패:", error);
    return NextResponse.json(
      { error: "회원 정보를 연결하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }
}

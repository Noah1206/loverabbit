import { NextRequest, NextResponse } from "next/server";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { seal } from "@/lib/crypto";
import {
  getDatabaseUserByAuthId,
  getDatabaseUserByEmail,
  isDatabaseConfigured,
  linkDatabaseUserAuth,
  signupDatabaseUser,
  type DatabaseAuthProvider,
  type DatabaseSocialUser,
  type ReferralRewardType,
} from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { UserToken } from "@/lib/tokens";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validAdultBirthdate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    year >= 1900 &&
    new Date().getFullYear() - year >= 19 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getTime() <= Date.now()
  );
}

function normalizeProvider(value: unknown): DatabaseAuthProvider | null {
  if (value === "google" || value === "kakao" || value === "x") return value;
  // Older GoTrue metadata can still use the historical provider name.
  return value === "twitter" ? "x" : null;
}

function normalizeReward(value: unknown): ReferralRewardType | undefined {
  return value === "reading_unlock" || value === "chat_credits" ? value : undefined;
}

function sessionResponse(
  user: DatabaseSocialUser,
  provider: DatabaseAuthProvider,
  referralClaimed = false
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
    chatCredits: user.chatCredits,
    referralClaimed,
    authProvider: provider,
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
    birthdate?: string;
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

    const birthdate = body.birthdate?.trim() ?? "";
    if (!birthdate) {
      return NextResponse.json({ needsProfile: true, email, authProvider: provider });
    }
    if (!validAdultBirthdate(birthdate)) {
      return NextResponse.json(
        { error: "러브레빗은 만 19세 이상 성인 전용 서비스입니다." },
        { status: 403 }
      );
    }

    const signup = await signupDatabaseUser({
      email,
      birthdate,
      marketingConsent: body.marketingOk === true,
      adultVerifiedAt: new Date().toISOString(),
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
    return sessionResponse(connected, provider, signup.referralClaimed);
  } catch (error) {
    console.error("소셜 로그인 회원 연결 실패:", error);
    return NextResponse.json(
      { error: "회원 정보를 연결하지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }
}

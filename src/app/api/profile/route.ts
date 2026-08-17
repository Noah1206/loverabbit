import { NextRequest, NextResponse } from "next/server";
import {
  getUserProfile,
  saveUserProfile,
  type ProfileTheme,
} from "@/lib/database";
import { resolveUserToken } from "@/lib/tokens";

type ProfileRequest = {
  userToken?: string;
  theme?: ProfileTheme;
};

async function authenticatedUser(body: ProfileRequest) {
  const user = await resolveUserToken(body.userToken);
  return user?.userId ? user : null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ProfileRequest;

  try {
    const user = await authenticatedUser(body);
    if (!user?.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const profile = await getUserProfile(user.userId);
    if (!profile) {
      return NextResponse.json({ theme: "dark", displayName: null });
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error("프로필 조회 실패:", error);
    return NextResponse.json({ error: "프로필을 불러오지 못했어요." }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ProfileRequest;
  if (body.theme !== "dark" && body.theme !== "light") {
    return NextResponse.json({ error: "지원하지 않는 테마예요." }, { status: 400 });
  }

  try {
    const user = await authenticatedUser(body);
    if (!user?.userId) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    const profile = await saveUserProfile(user.userId, { theme: body.theme });
    if (!profile) {
      return NextResponse.json({ error: "프로필 DB 연결을 확인해주세요." }, { status: 503 });
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error("프로필 저장 실패:", error);
    return NextResponse.json({ error: "프로필을 저장하지 못했어요." }, { status: 503 });
  }
}

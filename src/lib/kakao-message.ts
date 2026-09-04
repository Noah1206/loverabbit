import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/*
  카카오톡 '나에게 보내기' — 손님에게 알리는 길.

  승인은 결제 요청보다 몇 시간 뒤에 나고, 그때 손님은 화면 앞에 없다. 카카오로
  로그인하면서 "카카오톡 메시지 전송"(talk_message) 에 동의한 사람에게는 그 사람의
  카카오톡 '나와의 채팅'에 링크 카드를 보낼 수 있다. 알림톡이 아니라서 채널·템플릿
  심사·전화번호가 필요 없다. 대신 카카오로 로그인한 사람에게만 닿는다.

  지키는 것:
  1. 절대 던지지 않는다. 알림은 승인의 곁가지다 — 못 보내면 로그만 남긴다.
  2. 토큰이 없거나(구글·X 로그인, 옛 로그인), 동의가 없으면 조용히 건너뛴다.
  3. access 토큰이 낡았으면 refresh 로 새로 받아 저장한다. refresh 에는
     KAKAO_REST_API_KEY(와 켜 두었다면 KAKAO_CLIENT_SECRET)가 필요하다 — Supabase
     대시보드의 카카오 제공자에 넣은 것과 같은 값이다.

  카카오 개발자 콘솔에서 미리 해 둘 것: 앱을 비즈앱으로 전환, 동의항목에서
  "카카오톡 메시지 전송" 을 켜기, 플랫폼 Web 에 loverebbit.xyz 등록 (링크 카드의
  주소는 등록된 도메인이어야 한다).
*/

const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
const TIMEOUT_MS = 5_000;

export interface KakaoTokenInput {
  authUserId: string;
  accessToken: string;
  refreshToken?: string | null;
  /** access 만료까지 초. 모르면 보수적으로 1시간으로 본다. */
  expiresIn?: number | null;
  refreshExpiresIn?: number | null;
  scopes?: string | null;
}

/** 로그인 직후 받은 토큰을 저장한다. 실패해도 로그인은 막지 않는다. */
export async function saveKakaoTokens(input: KakaoTokenInput): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const now = Date.now();
  const accessSec = input.expiresIn && input.expiresIn > 0 ? input.expiresIn : 3600;
  const { error } = await db.from("lr_kakao_tokens").upsert(
    {
      auth_user_id: input.authUserId,
      access_token: input.accessToken,
      refresh_token: input.refreshToken ?? null,
      access_expires_at: new Date(now + accessSec * 1000).toISOString(),
      refresh_expires_at:
        input.refreshExpiresIn && input.refreshExpiresIn > 0
          ? new Date(now + input.refreshExpiresIn * 1000).toISOString()
          : new Date(now + 60 * 24 * 3600 * 1000).toISOString(),
      scopes: input.scopes ?? null,
      last_error: null,
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "auth_user_id" }
  );
  if (error) console.error("카카오 토큰 저장 실패:", error.message);
}

interface TokenRow {
  auth_user_id: string;
  access_token: string;
  refresh_token: string | null;
  access_expires_at: string;
  refresh_expires_at: string | null;
  scopes: string | null;
}

async function noteError(authUserId: string, message: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  await db
    .from("lr_kakao_tokens")
    .update({ last_error: message.slice(0, 300), updated_at: new Date().toISOString() })
    .eq("auth_user_id", authUserId);
}

/** access 토큰이 살아 있으면 그대로, 낡았으면 refresh 로 새로 받아 돌려준다. */
async function freshAccessToken(row: TokenRow): Promise<string | null> {
  const soon = Date.now() + 5 * 60 * 1000;
  if (new Date(row.access_expires_at).getTime() > soon) return row.access_token;

  const clientId = process.env.KAKAO_REST_API_KEY?.trim();
  if (!clientId) {
    await noteError(row.auth_user_id, "access 만료 — KAKAO_REST_API_KEY 가 없어 갱신 불가");
    return null;
  }
  if (!row.refresh_token) {
    await noteError(row.auth_user_id, "access 만료 — refresh 토큰 없음");
    return null;
  }
  if (row.refresh_expires_at && new Date(row.refresh_expires_at).getTime() < Date.now()) {
    await noteError(row.auth_user_id, "refresh 만료 — 다시 로그인 필요");
    return null;
  }

  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: row.refresh_token,
  });
  const secret = process.env.KAKAO_CLIENT_SECRET?.trim();
  if (secret) form.set("client_secret", secret);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    await noteError(row.auth_user_id, `refresh 실패 ${res.status} ${data.error ?? ""} ${data.error_description ?? ""}`);
    return null;
  }
  await saveKakaoTokens({
    authUserId: row.auth_user_id,
    accessToken: data.access_token,
    // 카카오는 refresh 가 한 달 안에 만료될 때만 새 refresh 를 준다.
    refreshToken: data.refresh_token ?? row.refresh_token,
    expiresIn: data.expires_in,
    refreshExpiresIn: data.refresh_token_expires_in,
    scopes: row.scopes,
  });
  return data.access_token;
}

export interface KakaoMemo {
  text: string;
  /** 카드의 링크. 카카오 앱에 등록된 도메인이어야 한다. */
  url: string;
  buttonTitle?: string;
  /** 카드 상단 그림(공개 https). 있으면 feed 템플릿으로 보낸다 — 토끼가 보인다. */
  imageUrl?: string;
  /** feed 템플릿의 굵은 제목. imageUrl 과 함께 쓴다. */
  title?: string;
}

/**
 * 회원(lr_users.id)의 카카오톡 '나와의 채팅'에 링크 카드를 보낸다.
 * 보냈으면 true. 못 보낸 이유는 로그와 last_error 에 남는다.
 */
export async function sendKakaoMemo(userId: number, memo: KakaoMemo): Promise<boolean> {
  try {
    const db = getSupabaseAdmin();
    if (!db) return false;

    const { data: user } = await db
      .from("lr_users")
      .select("auth_user_id,auth_provider")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.auth_user_id || user.auth_provider !== "kakao") return false;

    const { data: row } = await db
      .from("lr_kakao_tokens")
      .select("auth_user_id,access_token,refresh_token,access_expires_at,refresh_expires_at,scopes")
      .eq("auth_user_id", user.auth_user_id)
      .maybeSingle();
    if (!row) {
      console.log(`[카카오알림] userId=${userId} 토큰 없음 — talk_message 동의 전 로그인`);
      return false;
    }
    if (row.scopes && !row.scopes.split(/[\s,]+/).includes("talk_message")) {
      console.log(`[카카오알림] userId=${userId} 메시지 전송 동의 없음`);
      return false;
    }

    const token = await freshAccessToken(row as TokenRow);
    if (!token) return false;

    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: new URLSearchParams({
        // 그림이 있으면 feed 카드(그림+제목+본문+버튼), 없으면 기존 text 카드.
        template_object: JSON.stringify(
          memo.imageUrl
            ? {
                object_type: "feed",
                content: {
                  title: (memo.title ?? "러브레빗").slice(0, 100),
                  description: memo.text.slice(0, 200),
                  image_url: memo.imageUrl,
                  link: { web_url: memo.url, mobile_web_url: memo.url },
                },
                buttons: [
                  { title: memo.buttonTitle ?? "열기", link: { web_url: memo.url, mobile_web_url: memo.url } },
                ],
              }
            : {
                object_type: "text",
                text: memo.text.slice(0, 200),
                link: { web_url: memo.url, mobile_web_url: memo.url },
                button_title: memo.buttonTitle ?? "열기",
              }
        ),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[카카오알림] userId=${userId} 발송 실패 ${res.status}: ${body}`);
      await noteError(row.auth_user_id, `발송 실패 ${res.status}: ${body}`);
      return false;
    }
    console.log(`[카카오알림] userId=${userId} 발송`);
    return true;
  } catch (error) {
    console.error(`[카카오알림] userId=${userId} 오류:`, error);
    return false;
  }
}

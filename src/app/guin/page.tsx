"use client";

// 사주지도 — 진입과 생성.
//
// 로그인을 첫 단계에서 강제하지 않는다 (지시문 3.1). 소유권은 서버가 발급한
// ownerKey 로 이 브라우저에 남고, 로그인은 지도 화면에서 선택적으로 잇는다.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import GuinBirthForm, { type GuinFormValue } from "@/components/GuinBirthForm";
import { trackFunnel } from "@/lib/funnel";
import { fetchSavedBirth, myGuinMaps, rememberMyGuinMap, takeGuinPrefill, type GuinPrefill } from "@/lib/guin-local";
import { captureReferralFromLocation } from "@/lib/referral";
import { getUser } from "@/lib/user";
import TermSheet, { type TermPage } from "@/components/TermSheet";


/**
 * 사주지도가 쓰는 말들. 만세력과 같은 시트(TermSheet)를 쓴다 — 화면마다 다른
 * 설명 방식을 만들면 어느 쪽도 익숙해지지 않는다.
 *
 * 규칙 표(guin-map.ts)가 쓰는 것과 같은 뜻으로만 적는다. 여기서 새 주장을
 * 만들지 않는다 — 용어를 풀 뿐이다.
 */
const GUIN_TERMS: TermPage[] = [
  {
    title: "사주지도",
    body: "내 명식과 주변 사람의 명식을 견줘, 그 사람이 나에게 어떤 결의 인연인지 그린 지도예요. 사람을 넣을수록 지도가 넓어져요.",
  },
  {
    title: "귀인",
    body: "나를 살리는 쪽으로 작용하는 인연이에요. 좋은 사람이라는 뜻이 아니라, 내 기운이 부족한 자리를 그 사람이 채워 주는 관계라는 뜻이에요.",
  },
  {
    title: "관계의 역할",
    body: "안식처·오른팔·대화·성장처럼 이름이 붙어요. 상대의 일간이 내 일간에게 어떤 십성인지로 정해지고, 사람됨이 아니라 둘 사이의 결을 말해요.",
  },
  {
    title: "양방향",
    body: "나에게 그 사람이 어떤 인연인지와, 그 사람에게 내가 어떤 인연인지는 다를 수 있어요. 관계는 한쪽에서만 보면 절반만 보이거든요.",
  },
  {
    title: "지도에 올라간 사람",
    body: "내가 대신 넣은 사람은 임시로 표시돼요. 그 사람이 직접 들어와 자기 정보를 확인하면 정식 참여로 바뀌고, 원하지 않으면 스스로 지울 수 있어요.",
  },
];

const CREATE_CONSENT =
  "입력한 정보는 사주지도 관계 계산과 지도 관리에만 사용됩니다. 지도에 표시되는 이름은 별명이며, 생년월일과 출생시간은 다른 사람에게 공개하지 않습니다. 만 14세 이상만 이용할 수 있어요.";

const BUSY_MESSAGE =
  "지금 사주지도에 사람이 많이 몰리고 있어요. 입력 내용은 저장되지 않았으니 잠시 후 다시 시도해주세요.";

function GuinLanding() {
  const router = useRouter();
  const params = useSearchParams();
  // 초대 링크에서 "나도 만들기"로 넘어온 사람 — 2차 바이럴 계측용
  const fromInvite = params.get("from") === "invite";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 오프닝 영상은 뺐다 (2026-09-04 운영자) — 들어오면 바로 폼이다.
  // 참여 화면에서 넘어온 사람의 방금 입력값. 동의는 새로 받는다.
  const [prefill, setPrefill] = useState<GuinPrefill | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    // 초대 코드가 붙어 있으면 집어 둔다 — 지도 화면과 같은 이유.
    captureReferralFromLocation();
    // 이미 만든 지도가 있으면 묻지 않고 바로 연다 — 네비 탭은 입력을 다시
    // 시키지 않는다 (2026-08-31 운영자 결정). 최근 것 하나.
    const mine = myGuinMaps();
    if (mine.length > 0) {
      router.replace(`/guin/${mine[mine.length - 1].token}`);
      return;
    }
    trackFunnel("guin_landing_view", { path: "/guin" });
    trackFunnel("guin_form_started");
    // 초대에서 "나도 만들기"로 온 사람은 이미 결심했다 — 소개 화면을 다시
    // 보여주면 한 번 더 결심하게 만드는 셈이다. 값 채운 폼으로 바로 연다.
    if (fromInvite) {
      const kept = takeGuinPrefill();
      if (kept) setPrefill(kept);
      trackFunnel("guin_form_started");
      if (kept) return;
    }
    // 리딩에서 저장해 둔 내 사주가 있으면 그걸로 채운다 — 같은 사람에게
    // 같은 생년월일을 두 번 치게 하지 않는다. 별명만 새로 받는다.
    const stored = getUser();
    if (stored?.token) {
      void fetchSavedBirth(stored.token).then((saved) => {
        if (saved) setPrefill((prev) => prev ?? saved);
      });
    }
  }, [fromInvite]);

  const create = async (value: GuinFormValue) => {
    if (busy) return;
    setBusy(true);
    setError("");
    trackFunnel("guin_form_submitted");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("/api/guin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: value.nickname,
          birth: value.birth,
          consent: true,
          userToken: getUser()?.token,
        }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        ownerKey?: string;
        error?: string;
      };
      if (!res.ok || !data.token || !data.ownerKey) {
        if (res.status >= 500) trackFunnel("guin_server_error");
        throw new Error(data.error ?? BUSY_MESSAGE);
      }
      rememberMyGuinMap({
        token: data.token,
        ownerKey: data.ownerKey,
        nickname: value.nickname,
        createdAt: Date.now(),
      });
      trackFunnel("guin_map_created");
      if (fromInvite) trackFunnel("guin_second_map_created");
      router.push(`/guin/${data.token}`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        trackFunnel("guin_server_error");
        setError(BUSY_MESSAGE);
      } else {
        setError(e instanceof Error ? e.message : BUSY_MESSAGE);
      }
      setBusy(false);
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <main className="container guin-landing" style={{ paddingTop: 28 }}>
      {/* 딱딱한 제목+문단 대신 토끼가 서 있는 무대 — 폼은 그 아래 카드에 앉는다 */}
      <header className="guin-landing-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="guin-landing-rabbit" src="/assets/today/rabbit-hello-hanbok.webp" alt="" width={140} height={140} />
        <h1>
          내 주변에
          <br />
          어떤 <em>인연</em>이 있을까?
          <TermSheet pages={GUIN_TERMS} label="사주지도 용어 설명" />
        </h1>
        <p>
          생년월일 하나면 주변 사람들이 나에게 어떤 인연인지,
          <br />
          관계 지도 위에 별처럼 놓여요.
        </p>
        {/* 만들면 뭐가 나오는지 — 역할 이름을 미리 보여준다 */}
        <div className="guin-role-chips" aria-hidden>
          <span>🌟 귀인</span>
          <span>💪 오른팔형</span>
          <span>🌱 성장형</span>
          <span>🪞 거울형</span>
          <span>🛋️ 안식처형</span>
        </div>
      </header>

      <div className="guin-landing-form">
        <GuinBirthForm
          submitLabel="내 사주지도 만들기"
          consentNote={CREATE_CONSENT}
          busy={busy}
          onSubmit={create}
          initial={prefill}
        />
        {error && <p style={{ color: "var(--accent)", fontSize: "0.84rem", marginTop: 10 }}>{error}</p>}
        {error && (
          <button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => setError("")}>
            다시 시도하기
          </button>
        )}
      </div>
    </main>
  );
}

export default function GuinPage() {
  return (
    <Suspense fallback={<main className="container" style={{ paddingTop: 48 }} />}>
      <GuinLanding />
    </Suspense>
  );
}

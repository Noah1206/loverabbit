"use client";

// 귀인 지도 — 진입과 생성.
//
// 로그인을 첫 단계에서 강제하지 않는다 (지시문 3.1). 소유권은 서버가 발급한
// ownerKey 로 이 브라우저에 남고, 로그인은 지도 화면에서 선택적으로 잇는다.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import GuinBirthForm, { type GuinFormValue } from "@/components/GuinBirthForm";
import { trackFunnel } from "@/lib/funnel";
import { rememberMyGuinMap, takeGuinPrefill, type GuinPrefill } from "@/lib/guin-local";
import { getUser } from "@/lib/user";

const CREATE_CONSENT =
  "입력한 정보는 귀인 지도 관계 계산과 지도 관리에만 사용됩니다. 지도에 표시되는 이름은 별명이며, 생년월일과 출생시간은 다른 사람에게 공개하지 않습니다. 만 14세 이상만 이용할 수 있어요.";

const BUSY_MESSAGE =
  "지금 귀인지도에 사람이 많이 몰리고 있어요. 입력 내용은 저장되지 않았으니 잠시 후 다시 시도해주세요.";

function GuinLanding() {
  const router = useRouter();
  const params = useSearchParams();
  // 초대 링크에서 "나도 만들기"로 넘어온 사람 — 2차 바이럴 계측용
  const fromInvite = params.get("from") === "invite";

  const [mode, setMode] = useState<"intro" | "form" | "paste">("intro");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 참여 화면에서 넘어온 사람의 방금 입력값. 동의는 새로 받는다.
  const [prefill, setPrefill] = useState<GuinPrefill | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackFunnel("guin_landing_view", { path: "/guin" });
    // 초대에서 "나도 만들기"로 온 사람은 이미 결심했다 — 소개 화면을 다시
    // 보여주면 한 번 더 결심하게 만드는 셈이다. 값 채운 폼으로 바로 연다.
    if (fromInvite) {
      const kept = takeGuinPrefill();
      if (kept) setPrefill(kept);
      trackFunnel("guin_form_started");
      setMode("form");
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

  const openPasted = () => {
    // /guin/토큰 링크나 토큰만 붙여넣어도 들어가게 한다.
    const match = pasted.trim().match(/guin\/([A-Za-z0-9_-]{20,64})/) ?? pasted.trim().match(/^([A-Za-z0-9_-]{20,64})$/);
    if (!match) {
      setError("링크를 다시 확인해 주세요.");
      return;
    }
    router.push(`/guin/${match[1]}`);
  };

  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 120 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>GUIN MAP</p>
      <h1 style={{ marginBottom: 8 }}>내 주변에 어떤 인연이 있을까?</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
        생년월일을 입력하면 나와 잘 맞는 사람, 나를 도와주는 사람, 나를 성장시키는 사람을 관계
        지도에서 확인할 수 있어요.
      </p>

      {mode === "intro" && (
        <div style={{ display: "grid", gap: 10 }}>
          <button
            className="btn"
            style={{ width: "100%" }}
            onClick={() => {
              trackFunnel("guin_start_clicked");
              if (!getUser()) trackFunnel("guin_guest_mode_started");
              trackFunnel("guin_form_started");
              setMode("form");
            }}
          >
            내 귀인 지도 만들기
          </button>
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={() => setMode("paste")}>
            친구가 보낸 링크로 참여하기
          </button>
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", textAlign: "center" }}>
            가입 없이 이 브라우저에서 먼저 해볼 수 있어요. 로그인은 지도를 다른 기기에서도 볼 때만
            필요해요.
          </p>
        </div>
      )}

      {mode === "paste" && (
        <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
          <span style={{ fontSize: "0.86rem", fontWeight: 700 }}>친구가 보낸 링크</span>
          <input
            value={pasted}
            placeholder="https://loverebbit.xyz/guin/…"
            onChange={(e) => setPasted(e.target.value)}
          />
          {error && <p style={{ color: "var(--accent)", fontSize: "0.84rem" }}>{error}</p>}
          <button className="btn" onClick={openPasted}>
            지도 열기
          </button>
          <button className="btn btn-ghost" onClick={() => setMode("intro")}>
            뒤로
          </button>
        </div>
      )}

      {mode === "form" && (
        <div className="card" style={{ padding: 20 }}>
          <GuinBirthForm
            submitLabel="내 귀인 지도 만들기"
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
      )}
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

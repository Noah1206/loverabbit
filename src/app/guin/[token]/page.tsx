"use client";

// 귀인 지도 한 장 — 보는 사람과 인원에 따라 화면이 자란다.
//
//   보는 사람:  주인(전체+공유+설정) / 참여자(내 카드+지도) / 방문자(참여 화면만)
//   인원 단계:  0명 empty → 1명 관계 카드 → 2명 축별 비교 → 3명+ 분포·패턴
//
// 방문자 → 참여자 전환이 2차 바이럴의 심장이다 (지시문 5항). 참여를 마친
// 사람에게는 방금 넣은 값으로 자기 지도를 바로 만들 길을 연다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import GuinBirthForm, { type GuinFormValue } from "@/components/GuinBirthForm";
import { trackFunnel } from "@/lib/funnel";
import {
  fetchSavedBirth,
  forgetJoinedGuinMap,
  forgetMyGuinMap,
  joinIdempotencyKey,
  joinedGuinMap,
  ownerKeyOf,
  rememberGuinPrefill,
  rememberJoinedGuinMap,
  storedCopyVariant,
} from "@/lib/guin-local";
import {
  AXIS_LABEL,
  GUIN_AXES,
  GUIN_COPY,
  GUIN_DISCLAIMER,
  assignCopyVariant,
  getMapStage,
  normalizeCopyVariant,
  type GuinAxisKey,
  type GuinCopyVariant,
  type GuinMapView,
  type GuinNodeView,
  type GuinRole,
} from "@/lib/guin-map";
import { downloadGuinShareImage } from "@/lib/share-image";
import { getUser } from "@/lib/user";

const BUSY_MESSAGE = "지금 귀인지도에 사람이 많이 몰리고 있어요. 잠시 후 다시 시도해주세요.";

/** 역할 구분 점 색. 색만으로 가르지 않는다 — 라벨이 항상 같이 붙는다. */
const ROLE_DOT: Record<GuinRole, string> = {
  comforter: "#8fbfd8",
  right_hand: "#7dc4a5",
  communicator: "#9aa7d8",
  growth_teacher: "#c78d5a",
  // guin-1 시절 역할 — 저장된 지도를 그대로 그리기 위해 남긴다
  benefactor: "#e8b84b",
  mirror: "#b8a7d8",
  stimulator: "#d88da0",
  neutral: "#a5a3ac",
};

interface MapResponse extends GuinMapView {
  linkEnabled: boolean;
  claimed: boolean;
  myParticipantId: string | null;
  ownerPersona: { elementLabel: string; animal: string; dayGan: string } | null;
  error?: string;
}

function sizeBucket(n: number): string {
  return n === 0 ? "0" : n === 1 ? "1" : n === 2 ? "2" : n <= 4 ? "3-4" : "5plus";
}

export default function GuinMapPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [view, setView] = useState<MapResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [justJoined, setJustJoined] = useState<GuinNodeView | null>(null);
  // 로그인한 방문자의 저장된 사주 — 참여 폼을 미리 채운다 (별명은 새로 받는다)
  const [savedBirth, setSavedBirth] = useState<GuinFormValue | null>(null);
  const [myJoinValue, setMyJoinValue] = useState<GuinFormValue | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const inviteTracked = useRef(false);
  const stageTracked = useRef<string | null>(null);
  const claimTried = useRef(false);

  const ownerKey = useMemo(() => ownerKeyOf(token), [token]);
  const joined = useMemo(() => joinedGuinMap(token), [token]);

  // 초대 링크에 실려 온 카피 안 (?v=A|B|C). 없으면 A.
  const inviteVariant: GuinCopyVariant = useMemo(() => {
    if (typeof window === "undefined") return "A";
    return normalizeCopyVariant(new URLSearchParams(window.location.search).get("v"));
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`/api/guin/${encodeURIComponent(token)}`, {
        headers: {
          ...(ownerKey ? { "x-guin-owner-key": ownerKey } : {}),
          ...(joined?.participantKey ? { "x-guin-participant-key": joined.participantKey } : {}),
        },
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as MapResponse;
      if (!res.ok) {
        if (res.status >= 500) trackFunnel("guin_server_error");
        setErrorText(data.error ?? BUSY_MESSAGE);
        setStatus("error");
        return;
      }
      setView(data);
      setStatus("ready");
    } catch {
      trackFunnel("guin_server_error");
      setErrorText(BUSY_MESSAGE);
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }, [token, ownerKey, joined?.participantKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const stored = getUser();
    if (!stored?.token) return;
    void fetchSavedBirth(stored.token).then((saved) => {
      if (saved) setSavedBirth(saved);
    });
  }, []);

  // 방문자 계측 — 어느 카피가 데려왔는지가 product 로 남는다.
  useEffect(() => {
    if (view?.viewer === "stranger" && !inviteTracked.current) {
      inviteTracked.current = true;
      trackFunnel("guin_invite_landing_view", {
        product: `copy-${inviteVariant}`,
        landing: sizeBucket(view.count),
      });
    }
  }, [view, inviteVariant]);

  // 단계 화면 계측 — 같은 단계는 한 번만.
  useEffect(() => {
    if (!view || view.viewer === "stranger") return;
    const stage = getMapStage(view.count);
    if (stageTracked.current === stage) return;
    stageTracked.current = stage;
    if (stage === "two") trackFunnel("guin_axis_comparison_viewed", { landing: sizeBucket(view.count) });
    if (stage === "three_plus") trackFunnel("guin_pattern_report_viewed", { landing: sizeBucket(view.count) });
  }, [view]);

  // 게스트로 만든 지도를 로그인한 계정에 잇는다 — 한 번만, 조용히.
  useEffect(() => {
    if (claimTried.current || !view || view.viewer !== "owner" || view.claimed || !ownerKey) return;
    const user = getUser();
    if (!user?.token) return;
    claimTried.current = true;
    void fetch(`/api/guin/${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerKey, claimUserToken: user.token }),
    }).catch(() => {});
  }, [view, ownerKey, token]);

  const join = async (value: GuinFormValue) => {
    if (joining) return;
    setJoining(true);
    setJoinError("");
    trackFunnel("guin_participant_submitted", { product: `copy-${inviteVariant}` });
    try {
      const res = await fetch(`/api/guin/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: value.nickname,
          birth: value.birth,
          consent: true,
          idempotencyKey: joinIdempotencyKey(token),
          userToken: getUser()?.token,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        participantKey?: string;
        participantId?: string;
        node?: GuinNodeView;
        map?: GuinMapView;
        replayed?: boolean;
        error?: string;
      };
      if (!res.ok || !data.participantKey || !data.participantId || !data.node || !data.map) {
        if (res.status >= 500) trackFunnel("guin_server_error");
        throw new Error(data.error ?? BUSY_MESSAGE);
      }
      rememberJoinedGuinMap(token, {
        participantKey: data.participantKey,
        participantId: data.participantId,
        nickname: value.nickname,
      });
      setJustJoined(data.node);
      setMyJoinValue(value);
      if (data.replayed) setNotice("이미 이 지도에 참여한 기록이 있어요. 기존 관계 결과를 보여드릴게요.");
      setView((prev) =>
        prev
          ? { ...prev, ...data.map!, viewer: "participant", myParticipantId: data.participantId! }
          : prev
      );
      trackFunnel("guin_relationship_revealed", {
        product: data.node.role,
        landing: sizeBucket(data.map.count),
      });
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : BUSY_MESSAGE);
    } finally {
      setJoining(false);
    }
  };

  // 주인이 보낼 카피 — 한 번 배정되면 이 브라우저에서는 같은 안을 쓴다.
  const myVariant: GuinCopyVariant = useMemo(
    () => normalizeCopyVariant(storedCopyVariant(assignCopyVariant)),
    []
  );
  const shareUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/guin/${token}?v=${myVariant}`;

  const shareLink = async (event: "guin_share_link_copied" | "guin_result_card_shared") => {
    const text = GUIN_COPY[myVariant].shareText;
    try {
      if (navigator.share) {
        await navigator.share({ title: "귀인 지도", text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        setNotice("링크를 복사했어요. 친구에게 보내보세요.");
      }
      trackFunnel(event, { product: `copy-${myVariant}`, landing: sizeBucket(view?.count ?? 0) });
    } catch {
      // 공유 창을 닫은 것 — 아무 일도 아니다.
    }
  };

  const patchMap = async (patch: { showScores?: boolean; linkEnabled?: boolean }) => {
    if (!ownerKey) return;
    const res = await fetch(`/api/guin/${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerKey, ...patch }),
    }).catch(() => null);
    if (res?.ok) void load();
    else setNotice(BUSY_MESSAGE);
  };

  const deleteMap = async () => {
    if (!ownerKey || !window.confirm("지도와 참여자 기록이 모두 지워져요. 정말 지울까요?")) return;
    const res = await fetch(`/api/guin/${encodeURIComponent(token)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerKey }),
    }).catch(() => null);
    if (res?.ok) {
      trackFunnel("guin_map_deleted");
      forgetMyGuinMap(token);
      router.replace("/guin");
    } else setNotice(BUSY_MESSAGE);
  };

  const deleteParticipant = async (id: string) => {
    const isSelf = joined?.participantId === id;
    if (!window.confirm(isSelf ? "이 지도에서 내 기록을 지울까요?" : "이 사람을 지도에서 뺄까요?")) return;
    const res = await fetch(`/api/guin/${encodeURIComponent(token)}/participants/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(ownerKey ? { ownerKey } : {}),
        ...(joined?.participantKey ? { participantKey: joined.participantKey } : {}),
      }),
    }).catch(() => null);
    if (res?.ok) {
      trackFunnel("guin_participant_deleted");
      if (isSelf) {
        forgetJoinedGuinMap(token);
        setJustJoined(null);
      }
      setSelected(null);
      void load();
    } else setNotice(BUSY_MESSAGE);
  };

  const goMakeMyMap = () => {
    trackFunnel("guin_second_map_cta_clicked");
    // 방금 넣은 값을 자기 지도 폼에 미리 채운다. 동의는 새로 받는다 (지시문 5항).
    if (myJoinValue) rememberGuinPrefill(myJoinValue);
    router.push("/guin?from=invite");
  };

  // ── 로딩 / 오류 ──
  if (status === "loading") {
    return (
      <main className="container" style={{ paddingTop: 48 }}>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: "var(--text-dim)" }}>지도를 펼치는 중…</p>
        </div>
      </main>
    );
  }
  if (status === "error" || !view) {
    return (
      <main className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <h1 style={{ marginBottom: 8 }}>이 지도는 지금 열 수 없어요</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>{errorText}</p>
        <button className="btn" onClick={() => void load()}>다시 시도하기</button>
        <p style={{ marginTop: 14 }}>
          <Link href="/guin" style={{ color: "var(--accent)" }}>새로운 귀인 지도 만들어보기 →</Link>
        </p>
      </main>
    );
  }

  // ── 방문자: 참여 화면 (카피는 링크에 실려 온 안을 따른다) ──
  if (view.viewer === "stranger" && !justJoined) {
    const copy = GUIN_COPY[inviteVariant];
    return (
      <main className="container" style={{ paddingTop: 48, paddingBottom: 120 }}>
        <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>GUIN MAP</p>
        <h1 style={{ marginBottom: 8 }}>{copy.inviteTitle.replace("{owner}", view.ownerNickname)}</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 14 }}>{copy.inviteBody}</p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 20 }}>
          입력 후 {view.ownerNickname}님의 지도에 내 별명이 표시됩니다. 생년월일과 출생시간은
          공개되지 않습니다.
        </p>
        <div className="card" style={{ padding: 20 }}>
          <GuinBirthForm
            initial={savedBirth}
            submitLabel={copy.inviteCta}
            consentNote={`입력한 정보는 관계 계산과 지도 관리에 사용됩니다. 지도에는 별명만 표시되며, 생년월일과 출생시간은 공개되지 않습니다. 결과는 재미와 자기성찰을 위한 콘텐츠이며 실제 인간관계 판단을 대신하지 않습니다. 만 14세 이상만 이용할 수 있어요.`}
            busy={joining}
            onSubmit={join}
            onFirstTouch={() => trackFunnel("guin_participant_form_started", { product: `copy-${inviteVariant}` })}
          />
          {joinError && (
            <p style={{ color: "var(--accent)", fontSize: "0.84rem", marginTop: 10 }}>{joinError}</p>
          )}
          {joining && (
            <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginTop: 10 }}>
              두 사람의 관계를 살펴보고 있어요. 잠시만 기다려주세요.
            </p>
          )}
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: "0.76rem", marginTop: 16 }}>{GUIN_DISCLAIMER}</p>
      </main>
    );
  }

  // ── 지도 화면 ──
  const isOwner = view.viewer === "owner";
  const stage = getMapStage(view.count);
  const myNode = justJoined ?? view.nodes.find((node) => node.id === view.myParticipantId) ?? null;
  const filtered = filter.trim()
    ? view.nodes.filter((node) => node.nickname.includes(filter.trim()))
    : view.nodes;
  const selectedNode = view.nodes.find((node) => node.id === selected) ?? null;
  const roleSummary = summarizeRoles(view.nodes, view.roleCounts);

  const stageHeadline =
    stage === "empty"
      ? "아직 참여한 사람이 없어요"
      : stage === "one"
        ? "첫 번째 인연이 지도에 들어왔어요"
        : stage === "two"
          ? "2명의 인연이 모였어요"
          : `${view.count}명의 인연이 모였어요`;

  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 120 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>GUIN MAP</p>
      <h1 style={{ marginBottom: 4 }}>{view.ownerNickname}님의 귀인 지도</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 6 }}>
        {stageHeadline}
        {view.ownerPersona ? ` · ${view.ownerPersona.elementLabel} 기운의 ${view.ownerPersona.animal}띠` : ""}
      </p>
      {stage === "two" && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 8 }}>
          두 사람은 서로 다른 방식으로 당신에게 영향을 줘요.
        </p>
      )}
      {stage === "three_plus" && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 8 }}>
          이제 당신 주변의 관계 패턴이 보여요.
        </p>
      )}
      {notice && <p className="badge" style={{ marginBottom: 10 }}>{notice}</p>}

      {/* 방금 참여한 사람(또는 돌아온 참여자)의 결과 카드 */}
      {myNode && !isOwner && (
        <section className="card" style={{ padding: 20, marginBottom: 14, borderColor: ROLE_DOT[myNode.role] }}>
          <span className="badge">{view.ownerNickname}님에게 나는</span>
          <h2 style={{ fontSize: "1.3rem", margin: "10px 0 2px" }}>
            {myNode.roleLabel} 인연
            {myNode.secondaryRoleLabel ? ` · ${myNode.secondaryRoleLabel}` : ""}
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 10 }}>
            {myNode.roleTagline}
            {myNode.score !== null ? ` · 케미 ${myNode.score}점` : ""}
          </p>
          <NodeDetail node={myNode} />
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button className="btn" onClick={() => void goMakeMyMap()}>
              내 귀인 지도도 만들어보기
            </button>
            <button className="btn btn-ghost" onClick={() => void shareLink("guin_result_card_shared")}>
              내 결과 카드 공유하기
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => joined && void deleteParticipant(joined.participantId)}
            >
              이 지도에서 내 기록 지우기
            </button>
          </div>
        </section>
      )}

      {/* 주인: 공유 */}
      {isOwner && (
        <section className="card" style={{ padding: 20, marginBottom: 14 }}>
          <button
            className="btn"
            style={{ width: "100%" }}
            onClick={() => {
              if (!showShare) trackFunnel("guin_share_preview_opened", { landing: sizeBucket(view.count) });
              setShowShare((v) => !v);
            }}
          >
            {stage === "empty" ? "친구 초대해서 첫 관계 열기" : "친구 한 명 더 초대하기"}
          </button>
          {showShare && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {/* 공유 전 미리보기 — 카드에 실리는 전부. 생년월일·점수는 없다. */}
              <div className="card" style={{ padding: 14, background: "var(--bg)", fontSize: "0.86rem" }}>
                <strong>{view.ownerNickname}님의 귀인 지도</strong>
                <p style={{ color: "var(--text-dim)", margin: "4px 0" }}>
                  {view.count > 0 ? roleSummary : "아직 지도가 비어 있어요"}
                </p>
                <p>너는 나에게 어떤 인연일까? 생일만 입력하고 확인해보기</p>
              </div>
              <button className="btn" onClick={() => void shareLink("guin_share_link_copied")}>
                공유하기 · 링크 복사
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  downloadGuinShareImage(
                    view.ownerNickname,
                    view.count > 0 ? roleSummary.split(" · ") : ["아직 지도가 비어 있어요"]
                  );
                  trackFunnel("guin_share_image_downloaded");
                }}
              >
                인스타그램 스토리용 카드 저장
              </button>
            </div>
          )}
        </section>
      )}

      {/* 0명 — empty state */}
      {stage === "empty" && (
        <section className="card" style={{ padding: 24, textAlign: "center", marginBottom: 14 }}>
          <p aria-hidden style={{ fontSize: "2rem", marginBottom: 6 }}>○</p>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>아직 지도에 등록된 사람이 없어요</p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>
            친구 한 명이 들어오면 첫 번째 관계 카드가 열려요.
            <br />첫 번째 인연까지 1명 남았어요.
          </p>
        </section>
      )}

      {/* 2명 — 축별 비교 */}
      {stage === "two" && view.nodes.every((node) => node.axes) && (
        <AxisComparison nodes={view.nodes} showScores={isOwner || view.showScores} />
      )}

      {/* 3명+ — 분포와 패턴 리포트 */}
      {stage === "three_plus" && (
        <PatternReport nodes={view.nodes} roleSummary={roleSummary} />
      )}

      {/* 관계 카드 목록 */}
      {view.count > 0 && (
        <section className="card" style={{ padding: 20, marginBottom: 14 }}>
          {view.count > 20 && (
            <input
              value={filter}
              placeholder="별명으로 찾기"
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: "100%", marginBottom: 12 }}
            />
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((node) => (
              <button
                key={node.id}
                type="button"
                className="card"
                style={{ padding: 14, textAlign: "left", cursor: "pointer", borderColor: selected === node.id ? ROLE_DOT[node.role] : undefined }}
                onClick={() => setSelected(selected === node.id ? null : node.id)}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: ROLE_DOT[node.role] }} />
                  <strong>{node.nickname}</strong>
                  <span style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>
                    {node.roleLabel}
                    {node.score !== null ? ` · 케미 ${node.score}` : ""}
                  </span>
                </span>
                <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: 4 }}>{node.roleTagline}</p>
              </button>
            ))}
          </div>
          {selectedNode && (
            <div className="card" style={{ padding: 16, marginTop: 12, borderColor: ROLE_DOT[selectedNode.role] }}>
              <strong>
                {selectedNode.nickname}님은 당신에게 {selectedNode.roleLabel} 인연이에요
              </strong>
              <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", margin: "2px 0 8px" }}>
                {selectedNode.roleTagline}
                {selectedNode.score !== null ? ` · 케미 ${selectedNode.score}점` : ""}
                {selectedNode.secondaryRoleLabel ? ` · 보조: ${selectedNode.secondaryRoleLabel}` : ""}
              </p>
              <NodeDetail node={selectedNode} />
              {(isOwner || joined?.participantId === selectedNode.id) && (
                <button
                  className="btn btn-ghost"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={() => void deleteParticipant(selectedNode.id)}
                >
                  {joined?.participantId === selectedNode.id ? "내 기록 지우기" : "지도에서 빼기"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* 주인: 공개 범위 설정 */}
      {isOwner && (
        <section className="card" style={{ padding: 20, marginBottom: 14 }}>
          <button
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={() => {
              if (!showSettings) trackFunnel("guin_privacy_settings_opened");
              setShowSettings((v) => !v);
            }}
          >
            지도 공개 범위 설정
          </button>
          {showSettings && (
            <div style={{ marginTop: 12, display: "grid", gap: 10, fontSize: "0.88rem" }}>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>지도 링크 공개 (끄면 아무도 못 들어와요)</span>
                <input
                  type="checkbox"
                  checked={view.linkEnabled}
                  onChange={(e) => void patchMap({ linkEnabled: e.target.checked })}
                />
              </label>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>관계 점수 표시</span>
                <input
                  type="checkbox"
                  checked={view.showScores}
                  onChange={(e) => void patchMap({ showScores: e.target.checked })}
                />
              </label>
              <p style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>
                생년월일과 출생시간은 항상 비공개예요 — 끌 수 있는 설정이 아니라 처음부터 공개되지
                않아요.
              </p>
              <button className="btn btn-ghost" onClick={() => void deleteMap()}>
                지도와 내 데이터 전체 삭제
              </button>
            </div>
          )}
        </section>
      )}

      <p style={{ color: "var(--text-dim)", fontSize: "0.76rem" }}>{GUIN_DISCLAIMER}</p>
    </main>
  );
}

/** 역할 분포 요약 한 줄 — "안식처형 1명 · 오른팔형 2명" */
function summarizeRoles(
  nodes: GuinNodeView[],
  roleCounts: Partial<Record<GuinRole, number>>
): string {
  return Object.entries(roleCounts)
    .map(([role, count]) => {
      const sample = nodes.find((node) => node.role === role);
      return `${sample?.roleLabel ?? role} ${count}명`;
    })
    .join(" · ");
}

function NodeDetail({ node }: { node: GuinNodeView }) {
  const top = node.axes
    ? GUIN_AXES.reduce((best, key) => (node.axes![key] > node.axes![best] ? key : best), GUIN_AXES[0])
    : null;
  return (
    <div style={{ display: "grid", gap: 8, fontSize: "0.88rem" }}>
      {top && (
        <p style={{ color: "var(--text-dim)" }}>
          가장 강한 관계 축: <strong style={{ color: "var(--text)" }}>{AXIS_LABEL[top]}</strong>
        </p>
      )}
      {node.scoreBand && <p style={{ color: "var(--text-dim)" }}>{node.scoreBand}</p>}
      <div>
        <span style={{ fontWeight: 700 }}>잘 맞는 부분</span>
        {node.strengths.map((line) => (
          <p key={line} style={{ color: "var(--text-dim)", marginTop: 2 }}>· {line}</p>
        ))}
      </div>
      {node.cautions.length > 0 && (
        <div>
          <span style={{ fontWeight: 700 }}>관계의 힌트</span>
          {node.cautions.map((line) => (
            <p key={line} style={{ color: "var(--text-dim)", marginTop: 2 }}>· {line}</p>
          ))}
        </div>
      )}
      <p style={{ color: "var(--text-dim)" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>대화 질문</span> · “{node.conversationPrompt}”
      </p>
    </div>
  );
}

/** 축 점수 가로 막대 — 값이 숨겨진 지도에서는 부르지 않는다. */
function AxisBar({ nickname, value, color, best }: { nickname: string; value: number; color: string; best: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 34px", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: "0.84rem", fontWeight: best ? 800 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {nickname}
      </span>
      <span aria-hidden style={{ height: 10, borderRadius: 5, background: "var(--line)", overflow: "hidden", display: "block" }}>
        <span style={{ display: "block", width: `${value}%`, height: "100%", background: color, opacity: best ? 1 : 0.55 }} />
      </span>
      <b style={{ fontSize: "0.82rem", textAlign: "right" }}>{value}</b>
    </div>
  );
}

/** 2명 — 관계 축별 비교. 누가 더 좋은가가 아니라 어떤 축에서 누가 강한가. */
function AxisComparison({ nodes, showScores }: { nodes: GuinNodeView[]; showScores: boolean }) {
  const [axis, setAxis] = useState<GuinAxisKey>("comfort");
  const withAxes = nodes.filter((node) => node.axes);
  if (withAxes.length < 2) return null;
  const bestValue = Math.max(...withAxes.map((node) => node.axes![axis]));
  return (
    <section className="card" style={{ padding: 20, marginBottom: 14 }}>
      <span className="badge">관계 축 비교</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
        {GUIN_AXES.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip${axis === key ? " on" : ""}`}
            onClick={() => setAxis(key)}
          >
            {AXIS_LABEL[key]}
          </button>
        ))}
      </div>
      {showScores ? (
        <div style={{ display: "grid", gap: 8 }}>
          {withAxes.map((node) => (
            <AxisBar
              key={node.id}
              nickname={node.nickname}
              value={node.axes![axis]}
              color={ROLE_DOT[node.role]}
              best={node.axes![axis] === bestValue}
            />
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>
          지도 주인이 점수 표시를 꺼 두었어요. 역할로만 보여드려요.
        </p>
      )}
      <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginTop: 12 }}>
        {withAxes.map((node) => `${node.nickname}님은 ${node.roleTagline.replace(/사람$/, "관계")}`).join(", ")}예요.
      </p>
    </section>
  );
}

/** 3명+ — 분포 막대와 집단 해석, 축별 대표. 순위를 억지로 만들지 않는다. */
function PatternReport({ nodes, roleSummary }: { nodes: GuinNodeView[]; roleSummary: string }) {
  const total = nodes.length;
  const byRole = new Map<string, { label: string; role: GuinRole; count: number }>();
  for (const node of nodes) {
    const entry = byRole.get(node.role) ?? { label: node.roleLabel, role: node.role, count: 0 };
    entry.count += 1;
    byRole.set(node.role, entry);
  }
  const distribution = [...byRole.values()].sort((a, b) => b.count - a.count);
  const withAxes = nodes.filter((node) => node.axes);

  // 축별 대표 — 동점이면 공동 1위로 다 적는다.
  const topByAxis = GUIN_AXES.map((key) => {
    if (withAxes.length === 0) return null;
    const best = Math.max(...withAxes.map((node) => node.axes![key]));
    const winners = withAxes.filter((node) => node.axes![key] === best).map((node) => node.nickname);
    return { key, winners };
  }).filter((item) => item !== null);

  const diverse = distribution.length >= 3;
  return (
    <section className="card" style={{ padding: 20, marginBottom: 14 }}>
      <span className="badge">내 주변 인연 분포</span>
      <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
        {distribution.map((entry) => (
          <div key={entry.role} style={{ display: "grid", gridTemplateColumns: "84px 1fr 56px", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "0.84rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: ROLE_DOT[entry.role] }} />
              {entry.label}
            </span>
            <span aria-hidden style={{ height: 10, borderRadius: 5, background: "var(--line)", overflow: "hidden", display: "block" }}>
              <span style={{ display: "block", width: `${(entry.count / total) * 100}%`, height: "100%", background: ROLE_DOT[entry.role] }} />
            </span>
            <b style={{ fontSize: "0.82rem", textAlign: "right" }}>
              {entry.count}명 {Math.round((entry.count / total) * 100)}%
            </b>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 10 }}>
        {diverse
          ? "당신 주변에는 서로 다른 역할의 인연이 고르게 모여 있어요. 마음을 편하게 하는 사람, 현실적으로 움직이게 하는 사람, 새로운 방향을 여는 사람이 각자의 자리에 있어요."
          : `지금은 ${distribution[0]?.label ?? ""} 인연이 모여 있어요. 다음 초대가 지도의 폭을 넓혀 줄 거예요.`}
      </p>
      {topByAxis.length > 0 && (
        <div style={{ display: "grid", gap: 6, fontSize: "0.84rem" }}>
          {topByAxis.map((item) => (
            <p key={item!.key} style={{ color: "var(--text-dim)" }}>
              {AXIS_LABEL[item!.key]}이 가장 강한 관계:{" "}
              <strong style={{ color: "var(--text)" }}>{item!.winners.join(" · ")}</strong>
            </p>
          ))}
        </div>
      )}
      <p style={{ color: "var(--text-dim)", fontSize: "0.78rem", marginTop: 10 }}>{roleSummary}</p>
    </section>
  );
}

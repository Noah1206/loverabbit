"use client";

// 귀인 지도 한 장 — 보는 사람에 따라 세 화면이 된다.
//
//   주인      지도 전체 + 공유 + 설정
//   참여자    내 관계 카드 + 지도 + 내 기록 지우기 + "나도 만들기"
//   방문자    참여 화면만. 지도는 참여해야 보인다 (서버가 노드를 안 준다)
//
// 방문자 → 참여자 전환이 2차 바이럴의 심장이다 (지시문 3.5).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import GuinBirthForm, { type GuinFormValue } from "@/components/GuinBirthForm";
import { trackFunnel } from "@/lib/funnel";
import {
  forgetJoinedGuinMap,
  forgetMyGuinMap,
  joinIdempotencyKey,
  joinedGuinMap,
  ownerKeyOf,
  rememberJoinedGuinMap,
} from "@/lib/guin-local";
import { GUIN_DISCLAIMER, type GuinMapView, type GuinNodeView, type GuinRole } from "@/lib/guin-map";
import { downloadGuinShareImage } from "@/lib/share-image";
import { getUser } from "@/lib/user";

const BUSY_MESSAGE = "지금 귀인지도에 사람이 많이 몰리고 있어요. 잠시 후 다시 시도해주세요.";

/** 역할 구분 점 색. 색만으로 가르지 않는다 — 라벨이 항상 같이 붙는다. */
const ROLE_DOT: Record<GuinRole, string> = {
  benefactor: "#e8b84b",
  right_hand: "#7dc4a5",
  growth_teacher: "#c78d5a",
  mirror: "#9aa7d8",
  stimulator: "#d88da0",
  comforter: "#8fbfd8",
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
  return n === 0 ? "0" : n === 1 ? "1" : n <= 3 ? "2-3" : n <= 9 ? "4-9" : "10plus";
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
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const inviteTracked = useRef(false);
  const claimTried = useRef(false);

  const ownerKey = useMemo(() => ownerKeyOf(token), [token]);
  const joined = useMemo(() => joinedGuinMap(token), [token]);

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

  // 방문자 계측 — 초대 링크로 들어온 사람
  useEffect(() => {
    if (view?.viewer === "stranger" && !inviteTracked.current) {
      inviteTracked.current = true;
      trackFunnel("guin_invite_landing_view", { landing: sizeBucket(view.count) });
    }
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
    trackFunnel("guin_participant_submitted");
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

  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/guin/${token}`;
  const shareText = "내 귀인 지도에 너를 추가해봤어.\n생일만 입력하면 우리가 어떤 인연인지 나온대.";

  const shareLink = async (event: "guin_share_link_copied" | "guin_result_card_shared") => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "귀인 지도", text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setNotice("초대 링크를 복사했어요.");
      }
      trackFunnel(event, { landing: sizeBucket(view?.count ?? 0) });
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
        <h1 style={{ marginBottom: 8 }}>지도를 열지 못했어요</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>{errorText}</p>
        <button className="btn" onClick={() => void load()}>다시 시도하기</button>
        <p style={{ marginTop: 14 }}>
          <Link href="/guin" style={{ color: "var(--accent)" }}>내 지도 만들러 가기 →</Link>
        </p>
      </main>
    );
  }

  // ── 방문자: 참여 화면 ──
  if (view.viewer === "stranger" && !justJoined) {
    return (
      <main className="container" style={{ paddingTop: 48, paddingBottom: 120 }}>
        <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>GUIN MAP</p>
        <h1 style={{ marginBottom: 8 }}>{view.ownerNickname}님의 귀인 지도에 참여하기</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 14 }}>
          현재 {view.count}명 참여 중이에요. 생일만 입력하면 {view.ownerNickname}님과 내가 어떤
          인연인지 나와요.
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: 20 }}>
          입력 후 {view.ownerNickname}님의 지도에 내 별명이 표시됩니다. 생년월일과 출생시간은
          공개되지 않습니다.
        </p>
        <div className="card" style={{ padding: 20 }}>
          <GuinBirthForm
            submitLabel="내 관계 확인하기"
            consentNote={`입력한 정보는 관계 계산에만 사용됩니다. ${view.ownerNickname}님의 지도에는 별명만 표시돼요. 만 14세 이상만 이용할 수 있어요.`}
            busy={joining}
            onSubmit={join}
            onFirstTouch={() => trackFunnel("guin_participant_form_started")}
          />
          {joinError && (
            <p style={{ color: "var(--accent)", fontSize: "0.84rem", marginTop: 10 }}>{joinError}</p>
          )}
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: "0.76rem", marginTop: 16 }}>{GUIN_DISCLAIMER}</p>
      </main>
    );
  }

  // ── 지도 화면 (주인·참여자·방금 참여한 사람) ──
  const isOwner = view.viewer === "owner";
  const myNode =
    justJoined ?? view.nodes.find((node) => node.id === view.myParticipantId) ?? null;
  const filtered = filter.trim()
    ? view.nodes.filter((node) => node.nickname.includes(filter.trim()))
    : view.nodes;
  const selectedNode = view.nodes.find((node) => node.id === selected) ?? null;
  const roleSummary = Object.entries(view.roleCounts)
    .map(([role, count]) => {
      const sample = view.nodes.find((node) => node.role === role);
      return `${sample?.roleLabel ?? role} ${count}명`;
    })
    .join(" · ");

  return (
    <main className="container" style={{ paddingTop: 48, paddingBottom: 120 }}>
      <p style={{ color: "var(--accent)", fontWeight: 800, marginBottom: 8 }}>GUIN MAP</p>
      <h1 style={{ marginBottom: 4 }}>{view.ownerNickname}님의 귀인 지도</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 6 }}>
        현재 {view.count}명 참여
        {view.ownerPersona ? ` · ${view.ownerPersona.elementLabel} 기운의 ${view.ownerPersona.animal}띠` : ""}
      </p>
      {notice && <p className="badge" style={{ marginBottom: 10 }}>{notice}</p>}

      {/* 방금 참여한 사람의 결과 카드 — 이 화면이 다음 지도를 만든다 */}
      {myNode && !isOwner && (
        <section className="card" style={{ padding: 20, marginBottom: 14, borderColor: ROLE_DOT[myNode.role] }}>
          <span className="badge">{view.ownerNickname}님에게 나는</span>
          <h2 style={{ fontSize: "1.3rem", margin: "10px 0 2px" }}>
            {myNode.roleLabel} · {myNode.roleTagline}
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 10 }}>
            {myNode.elementLabel} 기운
            {myNode.score !== null ? ` · 케미 ${myNode.score}점` : ""}
          </p>
          <NodeDetail node={myNode} />
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button className="btn" onClick={() => void shareLink("guin_result_card_shared")}>
              이 결과 공유하기
            </button>
            <Link className="btn btn-ghost" href="/guin?from=invite" style={{ textAlign: "center" }}>
              나도 내 주변 인연 지도 만들기
            </Link>
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
            친구 초대하기
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

      {/* 지도 본체 */}
      {view.count === 0 ? (
        <section className="card" style={{ padding: 24, textAlign: "center", marginBottom: 14 }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>아직 지도에 등록된 사람이 없어요</p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.86rem" }}>
            친구 한 명을 초대하면 첫 번째 관계가 나타납니다.
          </p>
        </section>
      ) : (
        <section className="card" style={{ padding: 20, marginBottom: 14 }}>
          {view.count > 20 && (
            <input
              value={filter}
              placeholder="별명으로 찾기"
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: "100%", marginBottom: 12 }}
            />
          )}
          {view.count >= 4 ? (
            <CircleMap
              ownerNickname={view.ownerNickname}
              nodes={filtered}
              selected={selected}
              onSelect={setSelected}
            />
          ) : (
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
                      {node.score !== null ? ` · ${node.score}점` : ""}
                    </span>
                  </span>
                  <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: 4 }}>{node.roleTagline}</p>
                </button>
              ))}
            </div>
          )}
          {selectedNode && (
            <div className="card" style={{ padding: 16, marginTop: 12, borderColor: ROLE_DOT[selectedNode.role] }}>
              <strong>
                {selectedNode.nickname} · {selectedNode.roleLabel}
              </strong>
              <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", margin: "2px 0 8px" }}>
                {selectedNode.roleTagline} · {selectedNode.elementLabel} 기운
                {selectedNode.score !== null ? ` · 케미 ${selectedNode.score}점` : ""}
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

function NodeDetail({ node }: { node: GuinNodeView }) {
  return (
    <div style={{ display: "grid", gap: 8, fontSize: "0.88rem" }}>
      <div>
        <span style={{ fontWeight: 700 }}>잘 맞는 부분</span>
        {node.strengths.map((line) => (
          <p key={line} style={{ color: "var(--text-dim)", marginTop: 2 }}>· {line}</p>
        ))}
      </div>
      {node.cautions.length > 0 && (
        <div>
          <span style={{ fontWeight: 700 }}>주의할 부분</span>
          {node.cautions.map((line) => (
            <p key={line} style={{ color: "var(--text-dim)", marginTop: 2 }}>· {line}</p>
          ))}
        </div>
      )}
      <p style={{ color: "var(--text-dim)" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>대화 질문</span> · “{node.conversationPrompt}”
      </p>
      {node.facts.length > 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>근거: {node.facts.join(", ")}</p>
      )}
    </div>
  );
}

/** 4명부터는 원형 배치 — 가운데가 지도 주인이다. 노드를 누르면 상세가 열린다. */
function CircleMap({
  ownerNickname,
  nodes,
  selected,
  onSelect,
}: {
  ownerNickname: string;
  nodes: GuinNodeView[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const size = 340;
  const center = size / 2;
  const radius = 118;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="group"
      aria-label={`${ownerNickname}님의 관계 지도`}
    >
      {nodes.map((node, index) => {
        const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        const active = selected === node.id;
        return (
          <g
            key={node.id}
            onClick={() => onSelect(active ? null : node.id)}
            style={{ cursor: "pointer" }}
            role="button"
            aria-label={`${node.nickname} · ${node.roleLabel}`}
          >
            <line x1={center} y1={center} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />
            <circle
              cx={x}
              cy={y}
              r={22}
              fill={ROLE_DOT[node.role]}
              fillOpacity={active ? 0.55 : 0.28}
              stroke={ROLE_DOT[node.role]}
              strokeWidth={active ? 2.5 : 1.5}
            />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="var(--text)">
              {node.nickname.slice(0, 4)}
            </text>
            <text x={x} y={y + 38} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
              {node.roleLabel}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r={30} fill="var(--bg-card)" stroke="var(--accent)" strokeWidth={2} />
      <text x={center} y={center + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text)">
        {ownerNickname.slice(0, 4)}
      </text>
    </svg>
  );
}

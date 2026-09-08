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
import GuinMapBackground, { ROLE_DOT } from "@/components/GuinMapBackground";
import GuinMapIntro from "@/components/GuinMapIntro";
import SajuMapCanvas from "@/components/SajuMapCanvas";
import SajuPersonSheet from "@/components/SajuPersonSheet";
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
  GUIN_COPY,
  GUIN_DISCLAIMER,
  GUIN_STATUSES,
  STATUS_LABEL,
  assignCopyVariant,
  axisKeysOf,
  getMapStage,
  normalizeCopyVariant,
  type GuinAiReport,
  type GuinAxisKey,
  type GuinCopyVariant,
  type GuinMapView,
  type GuinNodeView,
  type GuinRelStatus,
  type GuinRole,
} from "@/lib/guin-map";
import { downloadGuinShareImage } from "@/lib/share-image";
import {
  discoveryOf,
  GROUP_LABEL,
  groupOf,
  RELATION_GROUPS,
  statusLine,
  type RelationGroup,
} from "@/lib/saju-map-view";
import { getUser } from "@/lib/user";

const BUSY_MESSAGE = "지금 사주지도에 사람이 많이 몰리고 있어요. 잠시 후 다시 시도해주세요.";

/*
  주인이 대신 넣을 때의 안내.

  본인이 아니라 내가 남의 생년월일을 넣는 자리다. 그래서 동의를 "그 사람이
  했다" 고 적지 않는다 — 내가 책임지고 넣는다는 것을 내가 확인하는 문장이다.
*/
const ADD_CONSENT =
  "내가 아는 사람의 정보를 대신 입력합니다. 실명 대신 별명을 권해요. 입력한 생년월일은 관계 계산에만 쓰이고 지도에 표시되지 않으며, 언제든 지울 수 있어요. 그 사람이 원하지 않으면 바로 삭제해 주세요.";

/*
  아직 아무도 안 들어온 지도에서 보여줄 네 자리.

  배경 지도(GuinMapBackground)가 네 방위에 하나씩 두는 역할과 같은 순서다 —
  화면의 점선 자리와 이 목록이 어긋나면 두 개의 지도로 읽힌다. 라벨과 한 줄
  설명은 GUIN_ROLES 의 것을 그대로 옮겼다(guin-map.ts). 여기서 새 말을 만들면
  같은 역할이 화면마다 다른 이름을 갖는다.
*/
const EMPTY_SLOT_HINTS: { role: GuinRole; label: string; hint: string }[] = [
  { role: "comforter", label: "안식처형", hint: "마음을 편하게 해주는 사람" },
  { role: "right_hand", label: "오른팔형", hint: "현실적으로 내 편이 되어주는 사람" },
  { role: "communicator", label: "대화형", hint: "서로의 생각을 풀어내기 쉬운 사람" },
  { role: "growth_teacher", label: "성장형", hint: "새로운 방향과 자극을 주는 사람" },
];

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

/** 오프닝을 이미 본 지도인지. 새로고침·뒤로가기로 다시 들어와도 두 번
 *  보여주지 않는다 — 두 번째부터는 방해다. 탭을 닫으면 잊는다. */
function introSeenKey(token: string): string {
  return `lr_guin_intro_${token}`;
}

export default function GuinMapPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [view, setView] = useState<MapResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  // 관계 갈래 필터. 고른 갈래 밖의 사람은 지우지 않고 가라앉힌다 —
  // 사라지면 "내 인연 8명" 과 화면의 수가 어긋난다.
  const [group, setGroup] = useState<RelationGroup>("all");
  // 지도에서 누른 사람의 시트. 목록의 선택(selected)과 같은 사람을 가리키되,
  // 시트를 닫아도 지도의 강조는 남는다 — 닫자마자 선이 흐려지면 무엇을 눌렀는지 잊는다.
  const [sheetOpen, setSheetOpen] = useState(false);
  // 주인이 직접 사람을 넣는 시트
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
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
  // 실제 관계 상태 + AI 리포트 (guin-v3). 서버 값이 정본이고 여기는 방금 고른 것.
  const [myStatus, setMyStatus] = useState<GuinRelStatus | null>(null);
  const [myAiReport, setMyAiReport] = useState<GuinAiReport | null>(null);
  const [contextSaving, setContextSaving] = useState(false);
  // 방금 참여한 사람의 단계형 공개 — 0: 내 역할만, 1: +반대 방향, 2: +상태·다음 행동.
  // 한 번에 하나씩만 새 것이 나타난다. 돌아온 참여자는 이미 본 사람이라 다 펼친다.
  const [revealStep, setRevealStep] = useState<0 | 1 | 2>(0);
  // 오프닝 — 초대로 들어온 방문자에게 폼 앞에서 한 번만. 이미 본 사람은
  // 다시 보지 않는다(sessionStorage). 주인·참여자는 아예 지나간다.
  const [introDone, setIntroDone] = useState(false);
  const inviteTracked = useRef(false);
  const stageTracked = useRef<string | null>(null);
  const claimTried = useRef(false);
  const bidirectionalTracked = useRef(false);

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

  /**
   * 주인이 사람을 직접 넣는다.
   *
   * 참여 API 를 그대로 쓰되 ownerKey 를 실어 보낸다 — 서버가 그 키로 주인인지
   * 확인하고 addedByOwner 로 표시한다. 넣고 나면 지도를 다시 읽어 새 사람이
   * 자리에 앉는 것을 그 자리에서 보여준다.
   */
  const addPerson = useCallback(
    async (value: GuinFormValue) => {
      if (adding) return;
      setAdding(true);
      setAddError("");
      try {
        const res = await fetch(`/api/guin/${encodeURIComponent(token)}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: value.nickname,
            birth: value.birth,
            ownerKey: ownerKeyOf(token),
            // 같은 사람을 두 번 눌러도 한 번만 들어가게. 별명까지 넣어 서로 다른
            // 사람을 연달아 넣을 때는 막히지 않게 한다.
            idempotencyKey: `${joinIdempotencyKey(token)}-${value.nickname}`,
            userToken: getUser()?.token,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? BUSY_MESSAGE);
        trackFunnel("guin_person_added", { landing: sizeBucket(view?.count ?? 0) });
        // 세 명이 모이면 귀인 순위가 열린다 — 그 순간을 따로 센다.
        if ((view?.count ?? 0) + 1 === 3) trackFunnel("guin_three_people_completed");
        setAddOpen(false);
        await load();
      } catch (e) {
        setAddError(e instanceof Error ? e.message : BUSY_MESSAGE);
      } finally {
        setAdding(false);
      }
    },
    [adding, token, view?.count, load]
  );


  useEffect(() => {
    void load();
  }, [load]);

  // 새로고침·뒤로가기로 돌아온 사람은 오프닝을 건너뛴다.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(introSeenKey(token))) setIntroDone(true);
    } catch {
      // 스토리지를 못 읽으면 그냥 보여준다 — 막을 일은 아니다.
    }
  }, [token]);

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

  // 양방향 카드 계측 — 역방향 결과가 **실제로 화면에 보인** 순간 한 번만.
  // 방금 참여한 사람은 "반대 방향 보기"를 눌러야 보이므로 revealStep 이 조건에 든다.
  useEffect(() => {
    if (bidirectionalTracked.current || !view || view.viewer !== "participant") return;
    const mine = justJoined ?? view.nodes.find((node) => node.id === view.myParticipantId) ?? null;
    if (!mine?.reverse) return;
    if (justJoined && revealStep < 1) return;
    bidirectionalTracked.current = true;
    trackFunnel("guin_bidirectional_viewed");
  }, [view, justJoined, revealStep]);

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
        await navigator.share({ title: "사주지도", text, url: shareUrl });
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

  /**
   * 실제 관계 상태 선택 (guin-v3). 상태는 축 점수를 바꾸지 않는다 — 서버가
   * 해석 문맥으로만 쓰고, 성공하면 AI 리포트가 같이 돌아온다. AI 가 실패해도
   * 오류가 아니다: 이미 보이는 템플릿 카드가 폴백이다.
   */
  const pickStatus = async (participantId: string, status: GuinRelStatus) => {
    if (contextSaving || !joined?.participantKey) return;
    setContextSaving(true);
    setMyStatus(status);
    trackFunnel("guin_context_status_selected", { product: status });
    try {
      const res = await fetch(
        `/api/guin/${encodeURIComponent(token)}/participants/${encodeURIComponent(participantId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantKey: joined.participantKey, status }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { aiReport?: GuinAiReport | null };
      if (res.ok && data.aiReport) {
        setMyAiReport(data.aiReport);
        trackFunnel("guin_ai_report_generated", { product: status });
      } else {
        setMyAiReport(null);
        trackFunnel("guin_ai_report_fallback", { product: status });
      }
    } catch {
      trackFunnel("guin_ai_report_fallback", { product: status });
    } finally {
      setContextSaving(false);
    }
  };

  const goMakeMyMap = () => {
    trackFunnel("guin_second_map_cta_clicked");
    // 방금 넣은 값을 자기 지도 폼에 미리 채운다. 동의는 새로 받는다 (지시문 5항).
    if (myJoinValue) rememberGuinPrefill(myJoinValue);
    router.push("/guin?from=invite");
  };

  // ── 로딩 / 오류 ──
  if (status === "loading") {
    // 로딩 화면을 그리지 않는다 (운영자 결정). 만들기의 토끼 로더에서
    // 넘어올 때 다른 화면이 사이에 번쩍이던 것을 없앤다 — 데이터가 오면
    // 바로 오프닝(또는 지도)이 선다. 그동안은 빈 흰 화면이다.
    return null;
  }
  if (status === "error" || !view) {
    return (
      <main className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <h1 style={{ marginBottom: 8 }}>이 지도는 지금 열 수 없어요</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>{errorText}</p>
        <button className="btn" onClick={() => void load()}>다시 시도하기</button>
        <p style={{ marginTop: 14 }}>
          <Link href="/guin" style={{ color: "var(--accent)" }}>새로운 사주지도 만들어보기 →</Link>
        </p>
      </main>
    );
  }

  // ── 오프닝 ── 지도가 열릴 때마다 한 번, 탭 세션당 지도마다 한 번만.
  // 처음 초대받아 온 방문자(빈 지도)만 full 을 본다 — 여기가 뭔지 모르는
  // 사람에게 보여주는 장면이라서다. 주인·참여자·재방문은 0.9초 compact 로
  // 짧게 지나간다 (지시문 1.2: 재방문은 1초 축약).
  if (!justJoined && !introDone) {
    return (
      <GuinMapIntro
        ownerNickname={view.ownerNickname}
        existingNodeCount={view.count}
        mode={view.viewer === "stranger" && view.count === 0 ? "full" : "compact"}
        onDone={(how) => {
          setIntroDone(true);
          trackFunnel(
            how === "completed" ? "guin_map_reveal_completed" : "guin_map_reveal_skipped",
            { product: `copy-${inviteVariant}`, landing: sizeBucket(view.count) }
          );
          try {
            sessionStorage.setItem(introSeenKey(token), "1");
          } catch {
            // 사파리 프라이빗 등 — 못 적어도 오프닝만 한 번 더 볼 뿐이다.
          }
        }}
      />
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
  // 방금 고른 값이 있으면 그것, 없으면 서버에 저장돼 있던 값 (돌아온 참여자).
  const shownStatus = myStatus ?? myNode?.contextStatus ?? null;
  const shownReport = myAiReport ?? myNode?.aiReport ?? null;
  // 방금 참여한 사람에게만 한 걸음씩 연다. 역방향이 없는 옛(v2) 기록이면 단계 없이 다 편다.
  const staged = justJoined !== null && Boolean(myNode?.reverse);
  const showReverse = !staged || revealStep >= 1;
  const showContext = !staged || revealStep >= 2;
  const filtered = filter.trim()
    ? view.nodes.filter((node) => node.nickname.includes(filter.trim()))
    : view.nodes;
  const selectedNode = view.nodes.find((node) => node.id === selected) ?? null;
  const roleSummary = summarizeRoles(view.nodes, view.roleCounts);

  /*
    지도가 쓰는 파생값 셋. 계산은 saju-map-view.ts 가 하고 여기서는 고르기만 한다.

    관계 갈래는 참여자가 고른 상태(contextStatus)에서 나온다. 아직 아무도 상태를
    안 골랐으면 갈래가 하나뿐이라 필터를 세우지 않는다 — 칩 한 줄이 전부 '친구'
    이면 그건 필터가 아니라 라벨이다.
  */
  const relationGroups = [
    ...new Set(view.nodes.map((node) => groupOf(node.contextStatus))),
  ].filter((key) => RELATION_GROUPS.includes(key));
  const dimmedIds = new Set(
    group === "all"
      ? []
      : view.nodes.filter((node) => groupOf(node.contextStatus) !== group).map((node) => node.id)
  );
  const discovery = discoveryOf(view.nodes);
  const sheetNode = sheetOpen ? (view.nodes.find((node) => node.id === selected) ?? null) : null;

  const stageHeadline =
    stage === "empty"
      ? "지도가 열렸어요 · 이제 인연이 앉을 차례"
      : stage === "one"
        ? "첫 번째 인연이 지도에 들어왔어요"
        : stage === "two"
          ? "2명의 인연이 모였어요"
          : `${view.count}명의 인연이 모였어요`;

  return (
    <>
      <GuinMapBackground
        ownerLabel={view.ownerNickname}
        nodes={view.nodes.map((node) => ({ id: node.id, nickname: node.nickname, role: node.role, score: node.score }))}
        selectedId={selected}
      />
    <main className="container guin-scene" style={{ paddingTop: 48, paddingBottom: 120 }}>
      <p style={{ color: "var(--text-dim)", fontWeight: 700, fontSize: "0.76rem", letterSpacing: "0.04em", marginBottom: 6 }}>
        MY SAJU MAP
      </p>
      <h1 style={{ marginBottom: 4 }}>{view.ownerNickname}님의 사주지도</h1>
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

      {/*
        지도 — 사람이 한 명이라도 있으면 여기서부터가 화면의 중심이다 (2026-09-08).

        배경(GuinMapBackground)은 만지지 못하는 그림이고, 이건 누를 수 있는
        사람들이다. 아래 관계 카드 목록과 같은 데이터를 쓰되, 목록은 읽는 자리고
        지도는 고르는 자리다 — 지도에서 고른 사람이 목록에서도 열린다.
      */}
      {(isOwner || showContext) && view.count > 0 && (
        <>
          {/* 갈래가 둘 이상일 때만 필터를 세운다. 하나뿐이면 고를 것이 없다. */}
          {relationGroups.length > 1 && (
            <div className="sm-filters" role="group" aria-label="관계로 걸러보기">
              {(["all", ...relationGroups] as RelationGroup[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`chip${group === key ? " on" : ""}`}
                  aria-pressed={group === key}
                  onClick={() => setGroup(key)}
                >
                  {GROUP_LABEL[key]}
                </button>
              ))}
            </div>
          )}

          <SajuMapCanvas
            meLabel={view.ownerNickname}
            people={view.nodes.map((node) => ({
              id: node.id,
              nickname: node.nickname,
              role: node.role,
              roleLabel: node.roleLabel,
              score: node.score,
            }))}
            selectedId={selected}
            dimmedIds={dimmedIds}
            onSelect={(id) => {
              setSelected(id);
              setSheetOpen(true);
            }}
          />

          {/* 발견 — "그래서 뭘 봐야 하는데" 에 답하는 한 줄. 없으면 안 그린다. */}
          {discovery && (
            <button
              type="button"
              className="sm-discovery"
              onClick={() => {
                setSelected(discovery.nodeId);
                setSheetOpen(true);
              }}
            >
              <i aria-hidden>{discovery.emoji}</i>
              <b>{discovery.text}</b>
              <span>확인하기 →</span>
            </button>
          )}
        </>
      )}

      {/* 방금 참여한 사람(또는 돌아온 참여자)의 결과 카드 — 양방향 (guin-v3) */}
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

          {/* 1단계 → 2단계: 반대 방향은 눌러야 열린다 — 한 번에 하나씩. */}
          {staged && revealStep === 0 && (
            <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={() => setRevealStep(1)}>
              그럼 나에게 {view.ownerNickname}님은? · 반대 방향 보기
            </button>
          )}

          {/* 역방향 — 색이 아니라 제목이 방향을 가른다 (지시문 4). */}
          {showReverse && myNode.reverse && (
            <div className="card" style={{ padding: 14, marginTop: 12, background: "var(--bg)" }}>
              <span className="badge">나에게 {view.ownerNickname}님은</span>
              <p style={{ fontWeight: 700, margin: "8px 0 2px" }}>
                {myNode.reverse.roleLabel} 인연
                {myNode.reverse.score !== null ? ` · 케미 ${myNode.reverse.score}점` : ""}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>{myNode.reverse.roleTagline}</p>
              {myNode.reverse.strengths[0] && (
                <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginTop: 6 }}>
                  · {myNode.reverse.strengths[0]}
                </p>
              )}
            </div>
          )}

          {/* 2단계 → 3단계 */}
          {staged && revealStep === 1 && (
            <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={() => setRevealStep(2)}>
              다음 · 지금 우리 관계 알려주기
            </button>
          )}

          {/* 실제 관계 상태 — 축 점수는 안 바뀐다. 해석의 초점만 바뀐다. */}
          {showContext && joined && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 8 }}>
                {view.ownerNickname}님과 지금 어떤 관계인가요?
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {GUIN_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`chip${shownStatus === status ? " on" : ""}`}
                    disabled={contextSaving}
                    onClick={() => void pickStatus(joined.participantId, status)}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              {contextSaving && (
                <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: 8 }}>
                  결과를 읽기 쉬운 관계 리포트로 정리하고 있어요…
                </p>
              )}
              <p style={{ color: "var(--text-dim)", fontSize: "0.76rem", marginTop: 6 }}>
                상태는 관계 점수를 바꾸지 않아요 — 지금 상황에 맞는 해석을 다듬는 데만 쓰여요.
                고르지 않아도 괜찮아요.
              </p>
            </div>
          )}

          {showContext && shownReport && !contextSaving && <AiReportCard report={shownReport} />}

          {showContext && (
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              <button className="btn" onClick={() => void goMakeMyMap()}>
                내 사주지도도 만들어보기
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
          )}
        </section>
      )}

      {/* 주인: 공유 */}
      {isOwner && (
        <section className="card" style={{ padding: 20, marginBottom: 14 }}>
          {/*
            사람을 넣는 길이 둘이다 (2026-09-08).

            위: 내가 직접 넣는다. 기다릴 것이 없어 지도가 바로 채워진다.
            아래: 친구에게 링크를 보낸다. 본인이 넣은 것이라 더 정확하고,
                  그 친구가 자기 지도를 만드는 데까지 이어진다.

            직접 넣기를 위에 둔다 — 링크만 있던 동안 지도 여섯 개가 전부
            비어 있었다. 다만 링크 쪽이 관계의 정본이므로 같이 남긴다.
          */}
          <button
            className="btn"
            style={{ width: "100%", marginBottom: 8 }}
            onClick={() => {
              trackFunnel("guin_person_add_started", { landing: sizeBucket(view.count) });
              setAddOpen(true);
            }}
          >
            + 인연 추가하기
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={() => {
              if (!showShare) trackFunnel("guin_share_preview_opened", { landing: sizeBucket(view.count) });
              setShowShare((v) => !v);
            }}
          >
            {stage === "empty" ? "친구에게 링크 보내기" : "친구에게 링크 보내기"}
          </button>
          {showShare && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {/* 공유 전 미리보기 — 카드에 실리는 전부. 생년월일·점수는 없다. */}
              <div className="card" style={{ padding: 14, background: "var(--bg)", fontSize: "0.86rem" }}>
                <strong>{view.ownerNickname}님의 사주지도</strong>
                <p style={{ color: "var(--text-dim)", margin: "4px 0" }}>
                  {view.count > 0 ? roleSummary : "지도의 중심에 나 한 사람"}
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
                    view.count > 0 ? roleSummary.split(" · ") : ["지도의 중심에 나 한 사람"]
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

      {/*
        0명 — 빈 지도가 아니라 **나 한 사람이 이미 서 있는 지도**다 (2026-09-08 운영자).

        전에는 "아직 등록된 사람이 없어요" 라고만 적힌 흰 카드였다. 만들자마자
        보는 화면이 그것이라, 방금 생년월일을 넣은 사람에게 돌아오는 것이 빈
        상자였다. 지도는 배경에 이미 그려져 있는데(GuinMapBackground 가 중앙에
        주인을 찍는다) 그 위에 "없어요" 카드를 덮어 가린 셈이다.

        그래서 카드를 내 자리 카드로 바꾼다. 별명과 오행·띠는 이미 서버가 보내는
        값이라(ownerPersona) 새로 계산할 것이 없다.
      */}
      {stage === "empty" && (
        <section className="card guin-solo" style={{ padding: 22, marginBottom: 14 }}>
          <span className="badge">지도의 중심</span>
          <h2 className="guin-solo-name">{view.ownerNickname}</h2>
          {view.ownerPersona && (
            <p className="guin-solo-persona">
              {view.ownerPersona.elementLabel} 기운의 {view.ownerPersona.animal}띠
            </p>
          )}
          <p className="guin-solo-note">
            아직 지도에 나밖에 없어요. 둘레의 빈 자리는 아직 오지 않은 인연이고,
            친구가 생일을 넣으면 그 자리에 하나씩 앉아요.
          </p>
          <ul className="guin-solo-slots" aria-label="아직 비어 있는 자리">
            {EMPTY_SLOT_HINTS.map((slot) => (
              <li key={slot.role}>
                <i aria-hidden style={{ background: ROLE_DOT[slot.role] }} />
                <b>{slot.label}</b>
                <span>{slot.hint}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 방금 참여한 사람에게는 아래 지도 섹션이 자기 카드 단계를 마친 뒤에 열린다 —
          화면에 새로 나타나는 것이 항상 하나가 되도록. */}
      {/* 2명 — 축별 비교 */}
      {(isOwner || showContext) && stage === "two" && view.nodes.every((node) => node.axes) && (
        <AxisComparison nodes={view.nodes} showScores={isOwner || view.showScores} />
      )}

      {/* 3명+ — 분포와 패턴 리포트 */}
      {(isOwner || showContext) && stage === "three_plus" && (
        <PatternReport nodes={view.nodes} roleSummary={roleSummary} />
      )}

      {/* 관계 카드 목록 */}
      {(isOwner || showContext) && view.count > 0 && (
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
              {selectedNode.reverse && (
                <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginTop: 8 }}>
                  거꾸로, {selectedNode.nickname}님에게 당신은{" "}
                  <strong style={{ color: "var(--text)" }}>{selectedNode.reverse.roleLabel}</strong> 인연이에요
                  {selectedNode.reverse.score !== null ? ` (케미 ${selectedNode.reverse.score}점)` : ""}.
                </p>
              )}
              {selectedNode.contextStatus && (
                <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginTop: 4 }}>
                  {selectedNode.nickname}님이 알려준 지금 관계: {STATUS_LABEL[selectedNode.contextStatus]}
                </p>
              )}
              {selectedNode.aiReport && <AiReportCard report={selectedNode.aiReport} />}
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
    <SajuPersonSheet node={sheetNode} onClose={() => setSheetOpen(false)} />

    {/* 주인이 직접 넣는 시트. 폼은 참여 화면과 같은 것을 쓴다 — 두 벌을 만들지 않는다. */}
    {addOpen && (
      <div className="rv-drawer" role="dialog" aria-label="인연 추가" onClick={() => setAddOpen(false)}>
        <div className="rv-drawer-sheet" onClick={(event) => event.stopPropagation()}>
          <header>
            <strong style={{ flex: 1 }}>누구를 추가할까요?</strong>
            <button type="button" className="rv-icon" onClick={() => setAddOpen(false)} aria-label="닫기">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginBottom: 12, lineHeight: 1.6 }}>
            친구가 알아볼 수 있는 별명이면 충분해요. 생년월일은 관계 계산에만 쓰고
            지도에 표시하지 않아요.
          </p>
          <GuinBirthForm
            submitLabel={adding ? "지도에 앉히는 중…" : "이 사람 지도에 추가하기"}
            consentNote={ADD_CONSENT}
            busy={adding}
            onSubmit={addPerson}
          />
          {addError && (
            <p style={{ color: "var(--semantic-error)", fontSize: "0.84rem", marginTop: 10 }}>{addError}</p>
          )}
        </div>
      </div>
    )}
    </>
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

/** 검증을 통과한 AI 리포트 — 없으면 이 카드 자체가 안 그려진다 (템플릿 폴백). */
function AiReportCard({ report }: { report: GuinAiReport }) {
  return (
    <div className="card" style={{ padding: 14, marginTop: 12, background: "var(--bg)", fontSize: "0.86rem" }}>
      <span className="badge">관계 리포트</span>
      <p style={{ marginTop: 8 }}>{report.summary}</p>
      <p style={{ color: "var(--text-dim)", marginTop: 6 }}>{report.roleExplanation}</p>
      <div style={{ marginTop: 8 }}>
        <span style={{ fontWeight: 700 }}>강점</span>
        {report.strengths.map((line) => (
          <p key={line} style={{ color: "var(--text-dim)", marginTop: 2 }}>· {line}</p>
        ))}
      </div>
      <p style={{ color: "var(--text-dim)", marginTop: 6 }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>주의점</span> · {report.caution}
      </p>
      <p style={{ color: "var(--text-dim)", marginTop: 6 }}>{report.currentContext}</p>
      <p style={{ color: "var(--text-dim)", marginTop: 6 }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>해볼 만한 것</span> · {report.suggestedAction}
      </p>
      <p style={{ color: "var(--text-dim)", marginTop: 6 }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>대화 질문</span> · “{report.conversationPrompt}”
      </p>
      <p style={{ color: "var(--text-dim)", fontSize: "0.74rem", marginTop: 8 }}>{report.disclaimer}</p>
    </div>
  );
}

function NodeDetail({ node }: { node: GuinNodeView }) {
  const keys = axisKeysOf(node.axes);
  const top = keys.length > 0 ? keys.reduce((best, key) => (node.axes![key]! > node.axes![best]! ? key : best)) : null;
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
      {/* 왜 이런 결과인가 — 이미 클라이언트에 와 있는 5축 값을 접어서 보여준다 */}
      {keys.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", color: "var(--text-dim)", fontSize: "0.84rem" }}>계산 근거 보기</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {keys.map((key) => (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "96px 1fr 34px", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>{AXIS_LABEL[key]}</span>
                <span aria-hidden style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden", display: "block" }}>
                  <span style={{ display: "block", width: `${node.axes![key]}%`, height: "100%", background: "var(--accent)", opacity: key === top ? 1 : 0.55 }} />
                </span>
                <b style={{ fontSize: "0.8rem", textAlign: "right" }}>{node.axes![key]}</b>
              </div>
            ))}
            <p style={{ color: "var(--text-dim)", fontSize: "0.78rem", marginTop: 2 }}>
              두 사람의 오행 관계({node.elementLabel})와 위 다섯 축으로 역할과 케미를 계산했어요.
            </p>
          </div>
        </details>
      )}
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
  // v2(4축)·v3(5축) 행이 섞이면 모두가 가진 축만 비교한다 — 빈 막대를 안 만든다.
  const sharedAxes = axisKeysOf(withAxes[0].axes).filter((key) =>
    withAxes.every((node) => typeof node.axes![key] === "number")
  );
  const activeAxis = sharedAxes.includes(axis) ? axis : sharedAxes[0];
  const bestValue = Math.max(...withAxes.map((node) => node.axes![activeAxis]!));
  return (
    <section className="card" style={{ padding: 20, marginBottom: 14 }}>
      <span className="badge">관계 축 비교</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
        {sharedAxes.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip${activeAxis === key ? " on" : ""}`}
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
              value={node.axes![activeAxis]!}
              color={ROLE_DOT[node.role]}
              best={node.axes![activeAxis] === bestValue}
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
  const sharedAxes =
    withAxes.length > 0
      ? axisKeysOf(withAxes[0].axes).filter((key) =>
          withAxes.every((node) => typeof node.axes![key] === "number")
        )
      : [];

  // 축별 대표 — 동점이면 공동 1위로 다 적는다.
  const topByAxis = sharedAxes.map((key) => {
    const best = Math.max(...withAxes.map((node) => node.axes![key]!));
    const winners = withAxes.filter((node) => node.axes![key] === best).map((node) => node.nickname);
    return { key, winners };
  });

  // 축 평균 → 강한 축과 더 탐색해볼 축 (지시문 6.3). 사람의 부족함이 아니라
  // 현재 지도에 들어온 관계 집합의 분포다 — 문구도 그렇게 쓴다.
  const averages = sharedAxes.map((key) => ({
    key,
    average: Math.round(withAxes.reduce((sum, node) => sum + node.axes![key]!, 0) / withAxes.length),
  }));
  const strongest = averages.length > 0 ? [...averages].sort((a, b) => b.average - a.average)[0] : null;
  const developing = averages.length > 1 ? [...averages].sort((a, b) => a.average - b.average)[0] : null;

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
      {strongest && developing && strongest.key !== developing.key && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.86rem", marginBottom: 10 }}>
          현재 지도에 등록된 인연 기준으로 <strong style={{ color: "var(--text)" }}>{AXIS_LABEL[strongest.key]}</strong>{" "}
          축이 가장 든든하고, <strong style={{ color: "var(--text)" }}>{AXIS_LABEL[developing.key]}</strong> 축은
          상대적으로 더 탐색해볼 여지가 있어요. 좋고 나쁨이 아니라 지금 들어온 사람들의 분포예요.
        </p>
      )}
      {topByAxis.length > 0 && (
        <div style={{ display: "grid", gap: 6, fontSize: "0.84rem" }}>
          {topByAxis.map((item) => (
            <p key={item.key} style={{ color: "var(--text-dim)" }}>
              {AXIS_LABEL[item.key]}이 가장 강한 관계:{" "}
              <strong style={{ color: "var(--text)" }}>{item.winners.join(" · ")}</strong>
            </p>
          ))}
        </div>
      )}
      <p style={{ color: "var(--text-dim)", fontSize: "0.78rem", marginTop: 10 }}>{roleSummary}</p>
    </section>
  );
}

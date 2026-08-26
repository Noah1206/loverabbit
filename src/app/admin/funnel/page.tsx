"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { BarRows, FunnelSteps, StatTile } from "@/components/FunnelCharts";

interface StageRow {
  name: string;
  label: string;
  sessions: number;
  dropped: number;
  passRate: number | null;
}
interface FormStepRow {
  step: string;
  label: string;
  reached: number;
  abandoned: number;
}
interface PageRow {
  path: string;
  views: number;
  exits: number;
  medianDwellMs: number | null;
}
interface SessionTrail {
  sessionId: string;
  userId: number | null;
  startedAt: string;
  endedAt: string;
  reached: string;
  lastPath: string | null;
  events: number;
}
interface SourceRow {
  source: string;
  campaign: string;
  content: string;
  sessions: number;
  reachedForm: number;
}
interface Report {
  sessions: number;
  events: number;
  ghosts: number;
  sources: SourceRow[];
  truncated: boolean;
  stages: StageRow[];
  formSteps: FormStepRow[];
  pages: PageRow[];
  trails: SessionTrail[];
}

const STORAGE_KEY = "loverabbit_admin_approval_key";

function seconds(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return Math.round(ms / 100) / 10 + "초";
  return Math.floor(ms / 60000) + "분 " + Math.round((ms % 60000) / 1000) + "초";
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminFunnelPage() {
  const [adminKey, setAdminKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (key: string, span: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/funnel?days=" + span, {
        headers: { Authorization: "Bearer " + key },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "퍼널을 불러오지 못했어요.");
      setReport(data.report as Report);
      setAdminKey(key);
      sessionStorage.setItem(STORAGE_KEY, key);
    } catch (reason) {
      setReport(null);
      setError(reason instanceof Error ? reason.message : "퍼널을 불러오지 못했어요.");
      if (reason instanceof Error && reason.message.includes("인증")) {
        setAdminKey("");
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setInputKey(saved);
      void load(saved, 7);
    }
  }, [load]);

  const login = (event: FormEvent) => {
    event.preventDefault();
    const key = inputKey.trim();
    if (key) void load(key, days);
  };

  if (!adminKey) {
    return (
      <main className="container admin-payments-page">
        <form className="card admin-login-card" onSubmit={login}>
          <span className="badge">관리자 전용</span>
          <h1>이탈 지점</h1>
          <p>운영 환경에 등록된 관리자 승인 키를 입력해주세요.</p>
          <label>
            관리자 승인 키
            <input
              type="password"
              value={inputKey}
              onChange={(event) => setInputKey(event.target.value)}
              autoComplete="current-password"
              placeholder="16자 이상의 승인 키"
            />
          </label>
          <button className="btn" type="submit" disabled={loading || !inputKey.trim()}>
            {loading ? "확인 중…" : "퍼널 열기"}
          </button>
          {error && <p className="payment-error">{error}</p>}
        </form>
      </main>
    );
  }

  const biggestDrop = report?.stages.reduce<StageRow | null>(
    (worst, row) => (!worst || row.dropped > worst.dropped ? row : worst),
    null
  );

  return (
    <main className="container admin-payments-page">
      <header className="admin-funnel-head">
        <div>
          <span className="badge">관리자 전용</span>
          <h1>사람들이 어디서 그만두는가</h1>
        </div>
        <div className="admin-funnel-span">
          {[1, 7, 30].map((span) => (
            <button
              key={span}
              type="button"
              className={"btn btn-ghost" + (span === days ? " is-active" : "")}
              onClick={() => {
                setDays(span);
                void load(adminKey, span);
              }}
            >
              {span === 1 ? "오늘" : span + "일"}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="payment-error">{error}</p>}
      {loading && <p className="admin-funnel-note">불러오는 중…</p>}

      {report && (
        <>
          {/* 맨 위는 차트가 아니라 숫자다. 한 값짜리 막대를 그리는 것보다
              크게 쓴 숫자가 빠르게 읽힌다. */}
          <div className="fc-stats">
            <StatTile label="방문" value={report.sessions.toLocaleString("ko-KR")} sub={`${days}일 · 발자국 ${report.events.toLocaleString("ko-KR")}개`} />
            <StatTile
              label="리딩 폼 진입"
              value={(report.stages.find((row) => row.name === "step_view")?.sessions ?? 0).toLocaleString("ko-KR")}
              sub={`방문의 ${report.sessions ? Math.round(((report.stages.find((row) => row.name === "step_view")?.sessions ?? 0) / report.sessions) * 100) : 0}%`}
            />
            <StatTile
              label="결제 완료"
              value={(report.stages.find((row) => row.name === "purchase_done")?.sessions ?? 0).toLocaleString("ko-KR")}
              sub="결제까지 간 세션"
            />
            {biggestDrop && biggestDrop.dropped > 0 && (
              <StatTile
                alert
                label="가장 많이 잃는 칸"
                value={biggestDrop.label}
                sub={`${biggestDrop.dropped.toLocaleString("ko-KR")}명이 여기서 그만둠`}
              />
            )}
          </div>

          <p className="admin-funnel-note">
            {days}일 동안 방문 <strong>{report.sessions}</strong>회 · 발자국{" "}
            {report.events.toLocaleString()}개
            {report.ghosts > 0 && (
              <>
                {" · Meta 사전 로딩 "}
                <strong>{report.ghosts}</strong>
                {"회는 뺐습니다"}
              </>
            )}
            {report.truncated && " · 상한에 걸려 최근 것만 셌습니다"}
            {biggestDrop && biggestDrop.dropped > 0 && (
              <>
                {" · 가장 많이 잃는 곳: "}
                <strong>{biggestDrop.label}</strong>
                {" (" + biggestDrop.dropped + "명)"}
              </>
            )}
          </p>

          <section className="card admin-funnel-card admin-funnel-wide">
            <h2>단계별 — 어디서 사람이 빠지는가</h2>
            <FunnelSteps rows={report.stages} />
          </section>

          <section className="card admin-funnel-card">
            <h2>리딩 폼의 어느 칸에서</h2>
            <BarRows
              emptyText="폼에 들어온 사람이 아직 없어요."
              partLabel="여기서 손 놓음"
              rows={report.formSteps
                .filter((row) => row.reached > 0)
                .map((row) => ({
                  key: row.step,
                  label: row.label,
                  value: row.reached,
                  part: row.abandoned,
                  note: row.abandoned > 0 ? "-" + row.abandoned : "",
                  tip: [
                    ["이 칸을 본 세션", row.reached.toLocaleString("ko-KR")],
                    ["여기서 손 놓음", row.abandoned.toLocaleString("ko-KR")],
                  ] as [string, string][],
                }))}
            />
          </section>

          <section className="card admin-funnel-card">
            <h2>어느 화면에서 나갔는가</h2>
            <BarRows
              emptyText="아직 쌓인 발자국이 없어요."
              partLabel="여기서 이탈"
              rows={report.pages.slice(0, 12).map((row) => ({
                key: row.path,
                label: row.path,
                value: row.views,
                part: row.exits,
                note: seconds(row.medianDwellMs),
                tip: [
                  ["열람", row.views.toLocaleString("ko-KR")],
                  ["여기서 이탈", row.exits.toLocaleString("ko-KR")],
                  ["머문 시간(중앙값)", seconds(row.medianDwellMs)],
                ] as [string, string][],
              }))}
            />
          </section>

          <section className="card admin-funnel-card">
            <h2>어디서 왔나</h2>
            <p className="admin-funnel-note">
              광고 링크의 utm 기준. 캠페인 이름이 중괄호 그대로면 Meta 광고의 URL 매개변수가
              치환되지 않은 것이라 광고 관리자에서 고쳐야 합니다.
            </p>
            {report.sources.length === 0 ? (
              <p className="admin-funnel-empty">아직 방문이 없어요.</p>
            ) : (
              <table className="admin-funnel-table">
                <thead>
                  <tr>
                    <th>출처</th>
                    <th>캠페인</th>
                    <th>소재</th>
                    <th>방문</th>
                    <th>폼 진입</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.slice(0, 30).map((row) => (
                    <tr key={row.source + "|" + row.campaign + "|" + row.content}>
                      <td>{row.source}</td>
                      <td className="admin-funnel-path">{row.campaign}</td>
                      <td className="admin-funnel-path">{row.content}</td>
                      <td>{row.sessions}</td>
                      <td>
                        {row.reachedForm}
                        {row.sessions > 0 && " (" + Math.round((row.reachedForm / row.sessions) * 100) + "%)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card admin-funnel-card">
            <h2>최근 방문</h2>
            {report.trails.length === 0 ? (
              <p className="admin-funnel-empty">아직 방문이 없어요.</p>
            ) : (
              <table className="admin-funnel-table">
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>회원</th>
                    <th>어디까지</th>
                    <th>마지막 화면</th>
                    <th>발자국</th>
                  </tr>
                </thead>
                <tbody>
                  {report.trails.slice(0, 40).map((row) => (
                    <tr key={row.sessionId}>
                      <td>{when(row.endedAt)}</td>
                      <td>{row.userId ? "#" + row.userId : "비회원"}</td>
                      <td>{row.reached}</td>
                      <td className="admin-funnel-path">{row.lastPath ?? "-"}</td>
                      <td>{row.events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}

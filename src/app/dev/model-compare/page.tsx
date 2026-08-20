"use client";

// 모델 비교 화면 (개발 전용).
//
// scripts/model-compare.mts 가 남긴 결과를 읽어 세 가지를 보여준다.
//   1. 표      — 모델별 총시간·비용·품질 지표를 한 줄씩
//   2. 막대    — 조각별 소요 시간. 전체 시간은 가장 느린 조각 하나가 정한다
//   3. 나란히  — 같은 절을 모델 수만큼 옆으로 놓고 문장을 직접 읽어 고른다
//
// "실제 뷰어로 보기"는 그 결과를 보관함(localStorage)에 넣고 /reading/{id} 로 보낸다.
// 리딩 뷰어가 localStorage에서만 읽는 클라이언트 페이지라, 넣어주지 않으면 뜨지 않는다.
// 이때 클릭 -> 첫 화면까지 걸린 시간을 재서 "화면" 구간으로 기록한다.

import { useEffect, useMemo, useState } from "react";
import { saveToArchive } from "@/lib/archive";
import type { StructuredReport } from "@/lib/reading-prompt";

interface Run {
  id: string;
  model: string;
  provider: string;
  note: string;
  ranAt: string;
  ok: boolean;
  error?: string;
  ms: { generate: number; guard: number; assemble: number; total: number };
  timings: { label: string; ms: number; ok: boolean; retry: boolean }[];
  requestCount: number;
  retryCount: number;
  failedParts: string[];
  usage: { input: number; output: number; cached: number; reasoning: number } | null;
  costUsd: number | null;
  guard: { blocking: number; warning: number; details: string[] };
  voice: { total: number; bad: number; samples: string[] };
  sections: number;
  expectedSections: number;
  avgSectionChars: number;
  report: StructuredReport | null;
  teaser: string;
  full: string;
}

interface ResultFile {
  product: { id: string; title: string; tocLength: number };
  subject: string;
  partner: string;
  question: string;
  batchSize: number;
  runs: Run[];
}

const NOT_HAEYO = /(합니다|입니다|습니다|됩니다|랍니다|십니다|한다|이다|지요)[.!?"']?\s*$/;
const RENDER_KEY = "loverabbit_model_compare_render";

const sec = (ms: number) => `${(ms / 1000).toFixed(1)}초`;
const num = (n: number) => n.toLocaleString();

/** 문장 단위로 잘라 해요체 위반 표시를 붙인다 */
function marked(text: string) {
  return text.split(/(?<=[.!?])\s+/).map((s, i) => {
    const bad = NOT_HAEYO.test(s.trim());
    return (
      <span key={i} className={bad ? "mc-bad" : undefined}>
        {s}{" "}
      </span>
    );
  });
}

export default function ModelComparePage() {
  const [data, setData] = useState<ResultFile | null>(null);
  const [error, setError] = useState("");
  const [pick, setPick] = useState(0);
  const [renderMs, setRenderMs] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/dev/model-compare", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "결과를 불러오지 못했어요.");
        setData(j);
      })
      .catch((e) => setError(String(e.message ?? e)));

    // 뷰어를 보고 돌아오면 그때 잰 렌더 시간이 여기 남아 있다
    try {
      const saved = localStorage.getItem(RENDER_KEY);
      if (saved) setRenderMs(JSON.parse(saved));
    } catch {
      /* 무시 */
    }
  }, []);

  // 절이 하나도 없으면 리포트가 아니다. 머리만 오고 본문이 전부 죽어도 report 객체는
  // 만들어지므로(빈 sections), 여기서 걸러야 표가 성공처럼 보이지 않는다.
  const ok = useMemo(
    () => (data?.runs ?? []).filter((r) => r.ok && r.report && r.report.sections.length > 0),
    [data]
  );
  const isOk = (r: Run) => r.ok && r.sections > 0;

  // 표에서 강조할 최소값들
  const best = useMemo(() => {
    if (ok.length === 0) return null;
    return {
      time: Math.min(...ok.map((r) => r.ms.total)),
      cost: Math.min(...ok.filter((r) => r.costUsd !== null).map((r) => r.costUsd as number)),
      voice: Math.min(...ok.map((r) => r.voice.bad / Math.max(1, r.voice.total))),
    };
  }, [ok]);

  // 절 제목은 모든 모델이 같다(서버가 목차에서 붙인다). 첫 성공 결과에서 가져온다.
  const titles = ok[0]?.report?.sections.map((s) => s.title) ?? [];

  function openViewer(run: Run) {
    if (!run.report) return;
    const id = `compare-${run.id}`;
    saveToArchive({
      readingId: id,
      blob: "",
      category: data?.product.id ?? "jjak",
      label: `[비교] ${run.id}`,
      characterId: "",
      teaser: run.teaser,
      full: run.full,
      chart: { me: data?.subject ?? "", partner: data?.partner ?? "" },
      price: 0,
      createdAt: Date.now(),
      report: run.report,
      summaryCards: run.report.summaryCards,
      disclaimer: run.report.meta.disclaimer,
      confidenceNote: run.report.meta.confidenceNote,
    });
    // 뷰어를 새 창으로 열고, 같은 출처라 접근할 수 있는 그쪽 DOM을 지켜본다.
    // 리딩 뷰어(/reading/[id])는 다른 작업이 잡고 있어 손대지 않는다 — 계측 코드를
    // 그쪽에 심지 않고 여기서만 재기 위한 방법이다.
    const started = performance.now();
    const win = window.open(`/reading/${id}`, "_blank");
    if (!win) {
      // 팝업이 막혔으면 화면 시간은 포기하고 같은 탭에서 연다.
      // 보는 것이 먼저고, 재는 것은 그다음이다.
      setNotice("팝업이 막혀 같은 탭에서 열어요. 화면 시간을 재려면 팝업을 허용해주세요.");
      window.location.href = `/reading/${id}`;
      return;
    }
    // .rv-body 는 장 본문이 실제로 그려졌을 때만 나온다. 로딩 화면에는 없다.
    const deadline = performance.now() + 15000;
    const tick = window.setInterval(() => {
      let painted = false;
      try {
        painted = Boolean(win.document?.querySelector(".rv-body, .rv-panel"));
      } catch {
        /* 아직 about:blank — 다음 차례에 다시 본다 */
      }
      if (painted || win.closed || performance.now() > deadline) {
        window.clearInterval(tick);
        if (!painted) return;
        const next = { ...renderMs, [run.id]: performance.now() - started };
        setRenderMs(next);
        localStorage.setItem(RENDER_KEY, JSON.stringify(next));
      }
    }, 25);
  }

  if (error)
    return (
      <main className="mc-wrap">
        <Style />
        <h1>모델 비교</h1>
        <p className="mc-err">{error}</p>
        <pre className="mc-cmd">npx tsx --env-file=.env scripts/model-compare.mts --dry</pre>
      </main>
    );

  if (!data)
    return (
      <main className="mc-wrap">
        <Style />
        <p>불러오는 중…</p>
      </main>
    );

  const isFake = data.runs.some((r) => r.provider === "fake");

  return (
    <main className="mc-wrap">
      <Style />
      <h1>
        모델 비교 {isFake && <span className="mc-tag">가짜 데이터</span>}
      </h1>
      <p className="mc-meta">
        {data.product.title} · 목차 {data.product.tocLength}개 · 배치 {data.batchSize} · 본인 {data.subject} · 상대{" "}
        {data.partner}
      </p>
      <p className="mc-meta">고민: “{data.question}”</p>

      {/* ── 표 ── */}
      <table className="mc-table">
        <thead>
          <tr>
            <th>모델</th>
            <th>총시간</th>
            <th>생성</th>
            <th>화면</th>
            <th>요청</th>
            <th>토큰 (입/출)</th>
            <th>실비</th>
            <th>가드</th>
            <th>해요체</th>
            <th>절</th>
            <th>평균 글자</th>
          </tr>
        </thead>
        <tbody>
          {data.runs.map((r) => {
            const rm = renderMs[r.id];
            const total = r.ms.total + (rm ?? 0);
            const voiceRate = r.voice.total ? r.voice.bad / r.voice.total : 0;
            return (
              <tr key={r.id} className={isOk(r) ? undefined : "mc-fail"}>
                <td>
                  <strong>{r.id}</strong>
                  <div className="mc-sub">{r.note}</div>
                  {r.model !== r.id && <div className="mc-sub">→ {r.model}</div>}
                </td>
                {isOk(r) ? (
                  <>
                    <td className={best && r.ms.total === best.time ? "mc-win" : undefined}>{sec(total)}</td>
                    <td>{sec(r.ms.generate)}</td>
                    <td>{rm === undefined ? <span className="mc-sub">미측정</span> : `${Math.round(rm)}ms`}</td>
                    <td>
                      {r.requestCount}
                      {r.retryCount > 0 && <span className="mc-warn"> (+{r.retryCount} 재시도)</span>}
                    </td>
                    <td>
                      {r.usage ? (
                        <>
                          {num(r.usage.input)} / {num(r.usage.output)}
                          {r.usage.cached > 0 && <div className="mc-sub">캐시 {num(r.usage.cached)}</div>}
                          {r.usage.reasoning > 0 && <div className="mc-sub">추론 {num(r.usage.reasoning)}</div>}
                        </>
                      ) : (
                        <span className="mc-sub">미제공</span>
                      )}
                    </td>
                    <td className={best && r.costUsd === best.cost ? "mc-win" : undefined}>
                      {r.costUsd === null ? "—" : `$${r.costUsd.toFixed(4)}`}
                    </td>
                    <td>
                      {r.guard.blocking > 0 ? (
                        <span className="mc-warn">차단 {r.guard.blocking}</span>
                      ) : r.guard.warning > 0 ? (
                        <span className="mc-sub">경고 {r.guard.warning}</span>
                      ) : (
                        "통과"
                      )}
                    </td>
                    <td className={best && voiceRate === best.voice ? "mc-win" : voiceRate > 0.1 ? "mc-warn" : undefined}>
                      {(voiceRate * 100).toFixed(0)}%
                      <div className="mc-sub">
                        {r.voice.bad}/{r.voice.total}
                      </div>
                    </td>
                    <td className={r.sections < r.expectedSections ? "mc-warn" : undefined}>
                      {r.sections}/{r.expectedSections}
                    </td>
                    <td>{r.avgSectionChars}</td>
                  </>
                ) : (
                  <td colSpan={10} className="mc-warn">
                    실패 — {r.error ?? `절이 0개예요 (실패 조각: ${r.failedParts.join(", ") || "불명"})`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mc-note">
        “화면”은 <strong>실제 뷰어로 보기</strong>를 눌러 리딩 뷰어가 첫 화면을 그릴 때까지 잰 값이에요. 누르기 전에는
        미측정으로 남아요. HTTP 왕복과 DB 저장은 이 측정에 들어 있지 않아요.
      </p>

      {/* ── 조각별 시간 ── */}
      <h2>조각별 시간</h2>
      <p className="mc-note">전체 시간은 합이 아니라 <strong>가장 느린 조각 하나</strong>가 정해요. 동시에 던지니까요.</p>
      <div className="mc-bars">
        {ok.map((r) => {
          const max = Math.max(...r.timings.map((t) => t.ms), 1);
          return (
            <div key={r.id} className="mc-barrow">
              <div className="mc-barname">{r.id}</div>
              <div className="mc-barlist">
                {r.timings.map((t, i) => (
                  <div key={i} className="mc-bar">
                    <span className="mc-barlabel">
                      {t.label} {t.retry && "↻"}
                    </span>
                    <span
                      className={`mc-barfill ${t.ok ? "" : "mc-barfail"} ${t.ms === max ? "mc-barmax" : ""}`}
                      style={{ width: `${(t.ms / max) * 100}%` }}
                    />
                    <span className="mc-barms">{(t.ms / 1000).toFixed(1)}s</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 뷰어 이동 ── */}
      <h2>실제 뷰어로 읽기</h2>
      {notice && <p className="mc-warn">{notice}</p>}
      <div className="mc-btns">
        {ok.map((r) => (
          <button key={r.id} className="mc-btn" onClick={() => openViewer(r)}>
            {r.id} 열기
          </button>
        ))}
      </div>

      {/* ── 절 나란히 ── */}
      <h2>같은 절 나란히 읽기</h2>
      <select className="mc-select" value={pick} onChange={(e) => setPick(Number(e.target.value))}>
        {titles.map((t, i) => (
          <option key={i} value={i}>
            {t}
          </option>
        ))}
      </select>
      <div className="mc-cols">
        {ok.map((r) => {
          const s = r.report!.sections[pick];
          if (!s) return null;
          return (
            <article key={r.id} className="mc-col">
              <h3>{r.id}</h3>
              <p className="mc-summary">{marked(s.summary)}</p>
              {s.paragraphs.map((p, i) => (
                <p key={i}>{marked(p)}</p>
              ))}
              {s.watchOut && (
                <p className="mc-watch">
                  <strong>살펴볼 점</strong> {marked(s.watchOut)}
                </p>
              )}
              <div className="mc-chips">
                {s.factsUsed.map((f, i) => (
                  <span key={i} className="mc-chip">
                    {f}
                  </span>
                ))}
              </div>
              {s.ruleIds.length > 0 && <div className="mc-sub">규칙 {s.ruleIds.join(", ")}</div>}
            </article>
          );
        })}
      </div>

      {/* ── 헤드라인·카드 ── */}
      <h2>헤드라인과 요약 카드</h2>
      <div className="mc-cols">
        {ok.map((r) => (
          <article key={r.id} className="mc-col">
            <h3>{r.id}</h3>
            <p className="mc-summary">{marked(r.report!.meta.headline)}</p>
            {r.report!.summaryCards.map((c, i) => (
              <p key={i}>
                <strong>{c.label}</strong> · {c.value}
                <br />
                {marked(c.detail)}
              </p>
            ))}
            <p className="mc-sub">{r.report!.meta.confidenceNote}</p>
          </article>
        ))}
      </div>

      {/* ── 가드 상세 ── */}
      <h2>가드 상세</h2>
      {ok.map((r) => (
        <div key={r.id} className="mc-guard">
          <strong>{r.id}</strong>
          {r.guard.details.length === 0 ? (
            <span className="mc-sub"> 위반 없음</span>
          ) : (
            <ul>
              {r.guard.details.map((d, i) => (
                <li key={i} className={d.startsWith("차단") ? "mc-warn" : "mc-sub"}>
                  {d}
                </li>
              ))}
            </ul>
          )}
          {r.voice.samples.length > 0 && (
            <ul>
              {r.voice.samples.map((v, i) => (
                <li key={i} className="mc-sub">
                  해요체 위반 · …{v.slice(-40)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </main>
  );
}

function Style() {
  return (
    <style>{`
      /* 앱 셸(.app-viewport)이 480px를 !important로 강제한다. 비교표는 넓어야 읽히므로
         고정 배치로 그 셸을 통째로 벗어난다. 개발 전용 화면이라 이렇게 해도 된다. */
      .mc-wrap { position: fixed; inset: 0; overflow-y: auto; z-index: 9999;
        padding: 24px clamp(16px, 3vw, 40px) 80px;
        font: 14px/1.7 system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #e8e6f0; background: #0a0a0c; }
      .mc-wrap > * { max-width: 1500px; margin-left: auto; margin-right: auto; }
      .mc-wrap h1 { font-size: 24px; margin: 0 0 4px; }
      .mc-wrap h2 { font-size: 17px; margin: 40px 0 8px; padding-top: 20px; border-top: 1px solid #2a2537; }
      .mc-wrap h3 { font-size: 14px; margin: 0 0 8px; color: #b9a8ff; }
      .mc-meta, .mc-note { color: #9a93ad; font-size: 13px; margin: 2px 0; }
      .mc-note { margin: 8px 0 0; }
      .mc-sub { color: #7d7591; font-size: 12px; }
      .mc-warn { color: #ff9a7a; }
      .mc-win { color: #6ee7b7; font-weight: 700; }
      .mc-err { color: #ff9a7a; }
      .mc-tag { background: #4a3f6b; color: #d9ccff; font-size: 12px; padding: 2px 8px; border-radius: 999px; vertical-align: middle; }
      .mc-cmd { background: #17142200; border: 1px solid #2a2537; padding: 10px; border-radius: 8px; overflow-x: auto; }
      .mc-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; display: block; overflow-x: auto; }
      .mc-table th, .mc-table td { border-bottom: 1px solid #221d31; padding: 8px 10px; text-align: left; vertical-align: top; white-space: nowrap; }
      .mc-table th { color: #9a93ad; font-weight: 600; font-size: 12px; }
      .mc-fail td { opacity: .75; }
      .mc-bars { display: grid; gap: 16px; margin-top: 12px; }
      .mc-barrow { display: grid; grid-template-columns: 190px 1fr; gap: 12px; align-items: start; }
      .mc-barname { color: #b9a8ff; font-size: 13px; }
      .mc-barlist { display: grid; gap: 4px; }
      .mc-bar { display: grid; grid-template-columns: 120px 1fr 52px; gap: 8px; align-items: center; }
      .mc-barlabel { font-size: 12px; color: #7d7591; }
      .mc-barfill { height: 12px; background: #5b46a8; border-radius: 3px; min-width: 2px; }
      .mc-barmax { background: #8b6ef0; }
      .mc-barfail { background: #7a3a3a; }
      .mc-barms { font-size: 12px; color: #9a93ad; text-align: right; }
      .mc-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .mc-btn { background: #2b2340; color: #e8e6f0; border: 1px solid #43395f; border-radius: 8px;
        padding: 8px 14px; cursor: pointer; font: inherit; font-size: 13px; }
      .mc-btn:hover { background: #372c52; }
      .mc-select { margin-top: 12px; background: #1a1626; color: #e8e6f0; border: 1px solid #43395f;
        border-radius: 8px; padding: 8px 10px; font: inherit; max-width: 100%; }
      .mc-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-top: 14px; }
      .mc-col { background: #121215; border: 1px solid #26262c; border-radius: 12px; padding: 14px; }
      .mc-col p { margin: 0 0 10px; }
      .mc-summary { color: #cfc8e6; }
      .mc-watch { border-left: 2px solid #6b5aa8; padding-left: 10px; color: #a99ec7; font-size: 13px; }
      .mc-bad { background: rgba(255, 120, 90, .22); border-radius: 3px; }
      .mc-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      .mc-chip { background: #1e1930; border: 1px solid #322a48; color: #8f86ad; font-size: 11px;
        padding: 2px 7px; border-radius: 999px; }
      .mc-guard { margin-top: 10px; }
      .mc-guard ul { margin: 4px 0 0; padding-left: 18px; }
    `}</style>
  );
}

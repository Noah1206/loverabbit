"use client";

import { useState } from "react";

/*
  퍼널 화면의 눈금들.

  표만 있던 자리에 막대를 넣는다. 표는 값을 정확히 읽게 하지만 "어디가 크게
  꺼지는가" 를 눈이 먼저 찾아 주지는 않는다 — 숫자 열두 줄을 머리로 비교해야
  했다. 막대는 그 비교를 눈에 맡기고, 숫자는 막대 옆에 그대로 남긴다.

  색은 하나다. 이 화면의 모든 막대가 답하는 질문이 "얼마나" 하나뿐이라
  (크기 비교) 계열을 나눌 이유가 없다. 여러 색을 쓰면 색이 뜻을 갖는 것처럼
  보여, 실제로는 없는 분류를 읽게 된다.

  빨강은 딱 한 군데 — 가장 많이 잃는 칸 — 에만 쓰고, 반드시 글자와 함께 쓴다.
  색만으로 뜻을 전하면 색을 못 보는 사람에게는 그 칸이 사라진다.
*/

const fmt = (n: number) => n.toLocaleString("ko-KR");

interface Datum {
  key: string;
  label: string;
  /** 막대의 길이를 정하는 값 */
  value: number;
  /** 막대 안에 더 짙게 채울 몫 (이탈처럼 value 의 부분집합) */
  part?: number;
  /** 막대 오른쪽에 붙는 보조 문구 */
  note?: string;
  /** 이 줄을 빨강으로 세운다. 반드시 note 와 함께 쓴다. */
  alert?: boolean;
  /** 마우스를 올렸을 때 보여줄 줄들 */
  tip?: [string, string][];
}

export function BarRows({
  rows,
  partLabel,
  emptyText,
}: {
  rows: Datum[];
  /** 짙은 몫이 무엇인지. 이게 있으면 범례가 선다. */
  partLabel?: string;
  emptyText: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  if (rows.length === 0) return <p className="admin-funnel-empty">{emptyText}</p>;

  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="fc-chart">
      {partLabel && (
        <div className="fc-legend">
          <span>
            <i className="fc-swatch fc-swatch-base" aria-hidden /> 전체
          </span>
          <span>
            <i className="fc-swatch fc-swatch-part" aria-hidden /> {partLabel}
          </span>
        </div>
      )}
      <ul className="fc-rows">
        {rows.map((row) => {
          const width = (row.value / max) * 100;
          const partWidth = row.part ? (row.part / row.value) * 100 : 0;
          return (
            <li
              key={row.key}
              className={"fc-row" + (row.alert ? " is-alert" : "")}
              onMouseEnter={() => setHover(row.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(row.key)}
              onBlur={() => setHover(null)}
              tabIndex={row.tip ? 0 : -1}
            >
              <span className="fc-label" title={row.label}>
                {row.label}
              </span>
              <span className="fc-track">
                <span className="fc-bar" style={{ width: width + "%" }}>
                  {row.part !== undefined && row.part > 0 && (
                    <span className="fc-part" style={{ width: partWidth + "%" }} />
                  )}
                </span>
              </span>
              <span className="fc-value">{fmt(row.value)}</span>
              <span className="fc-note">{row.note ?? ""}</span>
              {row.tip && hover === row.key && (
                <div className="fc-tip" role="tooltip">
                  <strong>{row.label}</strong>
                  {row.tip.map(([name, value]) => (
                    <span key={name}>
                      <em>{name}</em>
                      {value}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 단계 사이에서 몇 명이 사라졌는지를 계단으로 본다.
 *
 * 단계별 막대만으로는 "이 칸에서 잃었다" 가 안 보인다 — 앞 칸과 뒷 칸의 차이를
 * 눈으로 빼야 하기 때문이다. 그 차이를 막대 사이에 직접 적는다.
 */
export function FunnelSteps({
  rows,
}: {
  rows: { name: string; label: string; sessions: number; dropped: number; passRate: number | null }[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const live = rows.filter((row) => row.sessions > 0 || row.dropped > 0);
  if (live.length === 0) return <p className="admin-funnel-empty">아직 쌓인 발자국이 없어요.</p>;

  const max = Math.max(1, ...live.map((row) => row.sessions));
  const worst = live.reduce((a, b) => (b.dropped > a.dropped ? b : a), live[0]);

  return (
    <div className="fc-chart">
      <ol className="fc-steps">
        {live.map((row, index) => {
          const width = (row.sessions / max) * 100;
          const isWorst = row.dropped > 0 && row.name === worst.name;
          const next = live[index + 1];
          return (
            <li key={row.name}>
              <div
                className={"fc-step" + (isWorst ? " is-alert" : "")}
                onMouseEnter={() => setHover(row.name)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(row.name)}
                onBlur={() => setHover(null)}
                tabIndex={0}
              >
                <span className="fc-step-label">{row.label}</span>
                <span className="fc-track">
                  <span className="fc-bar" style={{ width: width + "%" }} />
                </span>
                <span className="fc-value">{fmt(row.sessions)}</span>
                {hover === row.name && (
                  <div className="fc-tip" role="tooltip">
                    <strong>{row.label}</strong>
                    <span>
                      <em>여기까지 온 세션</em>
                      {fmt(row.sessions)}
                    </span>
                    <span>
                      <em>앞 단계 대비</em>
                      {row.passRate === null ? "-" : row.passRate + "%"}
                    </span>
                    <span>
                      <em>여기서 이탈</em>
                      {fmt(row.dropped)}
                    </span>
                  </div>
                )}
              </div>
              {next && row.dropped > 0 && (
                <p className={"fc-gap" + (isWorst ? " is-alert" : "")}>
                  <span aria-hidden>↓</span> {fmt(row.dropped)}명이 여기서 그만둠
                  {isWorst && <strong> · 가장 많이 잃는 칸</strong>}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 한눈에 보는 숫자 한 칸. 막대 하나짜리 차트를 그리는 대신 숫자를 크게 쓴다. */
export function StatTile({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className={"fc-stat" + (alert ? " is-alert" : "")}>
      <small>{label}</small>
      <strong>{value}</strong>
      {sub && <span>{sub}</span>}
    </div>
  );
}

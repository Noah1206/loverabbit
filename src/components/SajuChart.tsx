"use client";

// 명식(원국) 표 — 만세력이 늘 보여주는 그 판이다.
//
// 시주·일주·월주·년주를 오른쪽에서 왼쪽 순서로 늘어놓고, 위가 천간 아래가 지지다.
// 글자마다 오행 색을 입힌다. 여기서 색은 장식이 아니라 정보다 — 목화토금수를
// 색으로 읽는 것이 만세력의 관습이라, 무채색으로 칠하면 판을 못 읽는다.
//
// 시각을 모르면 시주 자리는 세우지 않고 '모름'으로 비운다(계산도 그렇게 한다).
//
// 시주 아래에 진태양시 보정을 적는다 (2026-09-06). 서울 기준 시계보다 32분 앞선
// 시각으로 시주를 세우므로, 홀수 시 정각~32분 출생은 보정 없는 만세력과 한 칸
// 다르다. 그걸 모르면 "계해시인데 임술로 나온다"는 문의가 된다 — 버그가 아니라
// 기준 차이라는 걸 표 자리에서 바로 말한다.

import {
  CHEONGAN,
  CHEONGAN_HANJA,
  CHEONGAN_OHAENG,
  JIJI,
  JIJI_HANJA,
  JIJI_OHAENG,
  type SajuChart as Chart,
} from "@/lib/saju";

/** 오행별 색. 목=청 화=적 토=황 금=백 수=흑 이라는 전통 배색을 어두운 화면에 맞게 옮겼다. */
const OHAENG_CLASS: Record<string, string> = {
  목: "sj-wood",
  화: "sj-fire",
  토: "sj-earth",
  금: "sj-metal",
  수: "sj-water",
};

function Cell({ hanja, hangul, ohaeng }: { hanja: string; hangul: string; ohaeng: string }) {
  return (
    <div className={`sj-cell ${OHAENG_CLASS[ohaeng] ?? ""}`}>
      <strong>{hanja}</strong>
      <span>{hangul}</span>
    </div>
  );
}

function EmptyCell({ label }: { label: string }) {
  return (
    <div className="sj-cell sj-cell-empty">
      <strong>—</strong>
      <span>{label}</span>
    </div>
  );
}

export default function SajuChart({
  chart,
  name,
  birthLine,
}: {
  chart: Chart;
  name?: string;
  birthLine?: string;
}) {
  // 시 → 일 → 월 → 년. 만세력은 오른쪽이 년주고 왼쪽으로 갈수록 가까운 시간이다.
  const columns = [
    { label: "시주", pillar: chart.hour },
    { label: "일주", pillar: chart.day },
    { label: "월주", pillar: chart.month },
    { label: "년주", pillar: chart.year },
  ];

  // 저장된 옛 명식에는 moment 가 없을 수 있다 — 그러면 아무 말도 안 한다.
  const shift = chart.hour ? Math.round(-(chart.moment?.longitudeCorrectionMinutes ?? 0)) : 0;
  const dst = chart.moment?.notes?.some((n) => n.includes("서머타임 적용")) ?? false;

  return (
    <section className="sj-wrap" aria-label="내 명식">
      {(name || birthLine) && (
        <header className="sj-head">
          {name && <strong>{name}</strong>}
          {birthLine && <span>{birthLine}</span>}
        </header>
      )}

      <div className="sj-grid" role="table">
        <div className="sj-row sj-row-head" role="row">
          <span className="sj-axis" aria-hidden />
          {columns.map((col) => (
            <span key={col.label} className="sj-col-head" role="columnheader">
              {col.label}
            </span>
          ))}
        </div>

        <div className="sj-row" role="row">
          <span className="sj-axis" role="rowheader">천간</span>
          {columns.map((col) =>
            col.pillar ? (
              <Cell
                key={col.label}
                hanja={CHEONGAN_HANJA[col.pillar.ganIdx]}
                hangul={CHEONGAN[col.pillar.ganIdx]}
                ohaeng={CHEONGAN_OHAENG[col.pillar.ganIdx]}
              />
            ) : (
              <EmptyCell key={col.label} label="모름" />
            )
          )}
        </div>

        <div className="sj-row" role="row">
          <span className="sj-axis" role="rowheader">지지</span>
          {columns.map((col) =>
            col.pillar ? (
              <Cell
                key={col.label}
                hanja={JIJI_HANJA[col.pillar.jiIdx]}
                hangul={JIJI[col.pillar.jiIdx]}
                ohaeng={JIJI_OHAENG[col.pillar.jiIdx]}
              />
            ) : (
              <EmptyCell key={col.label} label="모름" />
            )
          )}
        </div>
      </div>

      {shift > 0 && (
        <p className="sj-note">
          시주는 시계 시각에서 {shift}분을 뺀 진태양시(서울 기준)로 세웠어요
          {dst ? ", 서머타임 1시간도 되돌렸어요" : ""}. 보정하지 않는 만세력과는 홀수 시 정각부터{" "}
          {shift}분 사이 출생(예: 21:00~21:{String(shift).padStart(2, "0")})에서 시주가 한 칸 다를 수 있어요.
        </p>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  RADAR_AXES,
  radarLabelPos,
  radarOf,
  radarPolygon,
  radarRing,
  type RadarPoint,
} from "@/lib/today-radar";
import { FLOW_OF, type Flow, type TenGod } from "@/lib/daily-action";
import { getUser } from "@/lib/user";

/*
  오늘의 사주 — 다섯 축을 오각형으로.

  왜 숫자를 안 적는가. 명리에 "재물운 87점" 같은 값은 없다. 있는 것은 오늘
  흐름에 어느 영역이 몇 번째로 붙는가이고(daily-action.ts 의 DOMAIN_PRIORITY),
  이 화면은 그 순서를 길이로 옮겨 그린다. 숫자를 적는 순간 없는 정밀함을
  주장하게 된다 — 모양만 보여주고, 읽는 것은 /today 가 한다.

  로그인 전에는 흐름을 모른다. 그때는 오각형을 흐리게 깔고 "내 오늘을 보려면"
  으로 넘긴다 — 아무 값이나 채워 넣으면 그건 남의 운세다.
*/

const SIZE = 220;

export default function TodayRadar() {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [ganji, setGanji] = useState<string>("");
  const [needsProfile, setNeedsProfile] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    let alive = true;
    fetch("/api/daily-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: user.token }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { flow?: { tenGod: TenGod; dayGanji: string }; needsProfile?: boolean } | null) => {
        if (!alive || !d) return;
        if (d.needsProfile) {
          setNeedsProfile(true);
          return;
        }
        /* 라우트는 십성을 준다. 흐름은 그 십성에서 나오므로(FLOW_OF) 응답을
           바꾸지 않고 여기서 옮긴다 — 서버 응답 모양을 건드리면 오늘의 사주
           화면까지 같이 손봐야 한다. */
        const tenGod = d.flow?.tenGod;
        if (tenGod && FLOW_OF[tenGod]) {
          setFlow(FLOW_OF[tenGod]);
          setGanji(d.flow?.dayGanji ?? "");
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* 흐름을 모르면 오각형을 고르게 깐다 — 값을 지어내는 대신 "아직 모른다"를
     모양으로 말한다. 그래서 이때는 도형에 색을 넣지 않는다. */
  const points: RadarPoint[] = flow
    ? radarOf(flow)
    : RADAR_AXES.map(({ domain, label }) => ({ domain, label, ratio: 0.62 }));

  const outer = radarRing(5, SIZE, 1);
  const mid = radarRing(5, SIZE, 0.66);
  const inner = radarRing(5, SIZE, 0.33);
  const shape = radarPolygon(points, SIZE);
  const known = Boolean(flow);

  return (
    <section className="tr-radar">
      <header>
        <small>총운</small>
        <h2>오늘의 운세 흐름 읽기</h2>
        {known && ganji && <p className="tr-radar-ganji">오늘의 일진 {ganji}</p>}
      </header>

      <div className={`tr-radar-chart${known ? "" : " is-dim"}`}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label="오늘의 다섯 영역 흐름">
          <polygon points={outer} className="tr-radar-grid" />
          <polygon points={mid} className="tr-radar-grid" />
          <polygon points={inner} className="tr-radar-grid" />
          {RADAR_AXES.map((_, i) => {
            const p = radarLabelPos(i, 5, SIZE);
            const c = SIZE / 2;
            return (
              <line
                key={i}
                x1={c}
                y1={c}
                x2={c + (p.x - c) / 1.2}
                y2={c + (p.y - c) / 1.2}
                className="tr-radar-spoke"
              />
            );
          })}
          <polygon points={shape} className="tr-radar-shape" />
        </svg>

        {/* 라벨은 SVG 밖에 둔다 — 글꼴 크기가 화면 설정을 따라야 읽힌다 */}
        {RADAR_AXES.map((axis, i) => {
          const p = radarLabelPos(i, 5, SIZE);
          return (
            <span
              key={axis.domain}
              className="tr-radar-label"
              style={{ left: `${(p.x / SIZE) * 100}%`, top: `${(p.y / SIZE) * 100}%` }}
            >
              {axis.label}
            </span>
          );
        })}
      </div>

      {known ? (
        <Link href="/today" className="tr-radar-cta">
          오늘 할 행동 하나 보기 <i aria-hidden>›</i>
        </Link>
      ) : (
        <Link href="/today" className="tr-radar-cta">
          {needsProfile ? "사주 정보 넣고 내 흐름 보기" : "내 오늘의 흐름 보기"} <i aria-hidden>›</i>
        </Link>
      )}
    </section>
  );
}

// 무료 만세력 계산기.
//
// 마케팅 진입점이다. 광고나 검색으로 들어온 사람이 회원가입도 결제도 없이
// 자기 명식을 본다. 그 판을 그대로 들고 유료 리딩으로 넘어갈 수 있게 아래에
// 무료 미리보기 링크를 둔다.
//
// 계산은 서버에서 끝낸다. 입력이 주소에 담기므로 결과가 그대로 공유 링크가 되고,
// 검색엔진이 읽을 본문도 서버 HTML 에 이미 들어 있다.

import type { Metadata } from "next";
import Link from "next/link";
import TermSheet, { type TermPage } from "@/components/TermSheet";
import ZodiacMark from "@/components/ZodiacMark";

import { josa } from "@/lib/korean-josa";
import { SITE_URL } from "@/lib/site";
import {
  buildManseryeok,
  parseManseryeokQuery,
  type Glyph,
  type Manseryeok,
} from "@/lib/manseryeok";
import ManseryeokForm from "./ManseryeokForm";


/**
 * 표 안에 그냥 적혀 있는 말들. 아는 사람에게는 이 설명이 전부 소음이라
 * 화면에 풀어 쓰지 않고 (i) 뒤에 둔다 — 묻는 사람에게만 답한다.
 *
 * 규칙 표(reading-rules.ts)가 쓰는 것과 같은 뜻으로만 적는다. 여기서 새 주장을
 * 만들지 않는다 — 용어를 풀 뿐이다.
 */
const MANSERYEOK_TERMS: TermPage[] = [
  {
    title: "만세력",
    body: "태어난 해·달·날·시각을 천간과 지지 여덟 글자로 옮긴 표예요. 절기와 진태양시까지 맞춰 계산하면 이 여덟 글자가 나오고, 사주 풀이는 전부 여기서 시작해요.",
  },
  {
    title: "명식 (사주 원국)",
    body: "여덟 글자를 네 기둥으로 세운 것이에요. 오른쪽부터 년주·월주·일주·시주 순서고, 각 기둥은 위가 천간 아래가 지지예요. 태어난 날의 천간(일간)이 나를 뜻하는 글자예요.",
  },
  {
    title: "십성",
    body: "일간을 기준으로 나머지 글자가 어떤 관계에 놓이는지 붙인 이름이에요. 비견·식신·정재·정관처럼 열 가지가 있고, 무엇이 많고 적은지가 성향과 흐름을 읽는 실마리가 돼요.",
  },
  {
    title: "지장간",
    body: "지지 한 글자 안에 숨어 있는 천간이에요. 겉으로는 한 글자지만 안에 두세 기운이 겹쳐 있어서, 겉 글자만으로 안 보이던 결이 여기서 드러나요.",
  },
  {
    title: "오행 · 강약",
    body: "여덟 글자를 목·화·토·금·수 다섯으로 세어 본 것이 오행 분포예요. 그중 일간과 같은 편이 얼마나 되는지로 일간의 힘을 신강·중화·신약으로 가려요.",
  },
];

export const metadata: Metadata = {
  title: "무료 만세력 — 사주 명식·십성·대운 한 번에 | 러브레빗",
  description:
    "생년월일시를 넣으면 사주 원국(명식)과 십성·지장간·오행 분포·신살·대운을 바로 계산합니다. 음력과 윤달, 진태양시 보정까지 반영한 무료 만세력.",
  alternates: { canonical: `${SITE_URL}/manseryeok` },
  openGraph: {
    title: "무료 만세력 — 내 사주 명식 바로 보기",
    description: "명식·십성·지장간·오행·신살·대운을 회원가입 없이 계산합니다.",
    url: `${SITE_URL}/manseryeok`,
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
};

const OHAENG_CLASS: Record<string, string> = {
  목: "sj-wood",
  화: "sj-fire",
  토: "sj-earth",
  금: "sj-metal",
  수: "sj-water",
};

function GlyphCell({ glyph, size = "lg" }: { glyph: Glyph | null; size?: "lg" | "sm" }) {
  if (!glyph) {
    return (
      <div className={`ms-glyph ms-glyph--${size} ms-glyph--empty`}>
        <strong>—</strong>
        <span>모름</span>
      </div>
    );
  }
  return (
    <div className={`ms-glyph ms-glyph--${size} ${OHAENG_CLASS[glyph.ohaeng] ?? ""}`}>
      <strong>{glyph.hanja}</strong>
      <span>
        {glyph.hangul}
        {glyph.ohaeng}
      </span>
    </div>
  );
}

function Chart({ data }: { data: Manseryeok }) {
  return (
    <section className="ms-card" aria-labelledby="ms-chart-title">
      <header className="ms-card-head">
        <h2 id="ms-chart-title">명식 (사주 원국)</h2>
        <p>{data.birthLine}</p>
      </header>

      {/*
        한눈 요약 (2026-09-08).

        전에는 표 **아래** 작은 줄이었다. 여덟 글자를 읽을 줄 아는 사람에게는
        그걸로 됐지만, 처음 온 사람은 표를 보다 지쳐 거기까지 못 갔다 —
        만세력은 마케팅 진입점이라 처음 온 사람이 다수다.

        일간·띠·강약은 이미 계산돼 있던 값이다. 계산을 더한 것이 아니라
        읽는 순서를 뒤집었다: 결론 셋을 먼저 보고 그 근거인 표로 내려간다.
      */}
      <div className="ms-top">
        <div className="ms-top-item">
          <span className={`ms-top-badge ${OHAENG_CLASS[data.dayMaster.ohaeng]}`}>
            {data.dayMaster.hanja}
          </span>
          <strong>{data.dayMaster.label}</strong>
          <small>일간 · 나를 뜻하는 글자</small>
        </div>
        <div className="ms-top-item">
          <span className="ms-top-badge ms-top-badge--art">
            <ZodiacMark animal={data.animal} size={44} />
          </span>
          <strong>{data.animal}</strong>
          <small>띠 · 태어난 해</small>
        </div>
        <div className="ms-top-item">
          {/* 원 안과 아래가 같은 말이면 한 번만 한다 — 원에는 첫 글자만 */}
          <span className="ms-top-badge ms-top-badge--plain">
            {data.facts.strength.label.slice(0, 1)}
          </span>
          <strong>{data.facts.strength.label}</strong>
          <small>일간의 힘</small>
        </div>
      </div>

      {/* 만세력은 오른쪽이 년주고 왼쪽으로 갈수록 가까운 시간이다. */}
      <div className="ms-grid">
        <div className="ms-row ms-row--head">
          <span className="ms-axis" aria-hidden />
          {data.pillars.map((pillar) => (
            <span key={pillar.label} className="ms-col-head">
              {pillar.label}
            </span>
          ))}
        </div>

        <div className="ms-row">
          <span className="ms-axis">십성</span>
          {data.pillars.map((pillar) => (
            <span key={pillar.label} className="ms-tengod">
              {pillar.stem?.tenGod || "—"}
            </span>
          ))}
        </div>

        <div className="ms-row">
          <span className="ms-axis">천간</span>
          {data.pillars.map((pillar) => (
            <GlyphCell key={pillar.label} glyph={pillar.stem} />
          ))}
        </div>

        <div className="ms-row">
          <span className="ms-axis">지지</span>
          {data.pillars.map((pillar) => (
            <GlyphCell key={pillar.label} glyph={pillar.branch} />
          ))}
        </div>

        <div className="ms-row">
          <span className="ms-axis">십성</span>
          {data.pillars.map((pillar) => (
            <span key={pillar.label} className="ms-tengod">
              {pillar.branch?.tenGod || "—"}
            </span>
          ))}
        </div>

        <div className="ms-row">
          <span className="ms-axis">지장간</span>
          {data.pillars.map((pillar) => (
            <div key={pillar.label} className="ms-hidden">
              {pillar.hidden.length === 0 && <em>—</em>}
              {pillar.hidden.map((hidden) => (
                <span key={hidden.role} className={OHAENG_CLASS[hidden.ohaeng] ?? ""}>
                  <b>{hidden.stem}</b>
                  <i>{hidden.tenGod}</i>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}

function Elements({ data }: { data: Manseryeok }) {
  return (
    <section className="ms-card" aria-labelledby="ms-element-title">
      <header className="ms-card-head">
        <h2 id="ms-element-title">오행 분포</h2>
        <p>천간과 지지 여덟 글자를 오행으로 센 값입니다.</p>
      </header>

      <div className="ms-bars">
        {data.elementBars.map((bar) => (
          <div key={bar.ohaeng} className={`ms-bar ${OHAENG_CLASS[bar.ohaeng]}`}>
            <span className="ms-bar-name">{bar.ohaeng}</span>
            <span className="ms-bar-track">
              <i style={{ width: `${bar.ratio}%` }} />
            </span>
            <span className="ms-bar-count">{bar.count}</span>
          </div>
        ))}
      </div>

      {/* 겉으로 안 드러난 것과 아예 없는 것은 다르다. 같은 말로 부르면 안 된다. */}
      {data.facts.hiddenOnlyElements.length > 0 && (
        <p className="ms-note">
          <b>{data.facts.hiddenOnlyElements.join("·")}</b>
          {josa(data.facts.hiddenOnlyElements.at(-1) ?? "", "은는")} 겉으로는 안 보이지만
          지장간에 들어 있어요.
        </p>
      )}
      {data.facts.absentElements.length > 0 && (
        <p className="ms-note">
          <b>{data.facts.absentElements.join("·")}</b>
          {josa(data.facts.absentElements.at(-1) ?? "", "은는")} 지장간까지 열어도 없습니다.
        </p>
      )}
    </section>
  );
}

function Relations({ data }: { data: Manseryeok }) {
  const { notableRelations, xing, shinsal, dominantTenGods } = data.facts;
  const nothing =
    notableRelations.length === 0 && xing.length === 0 && shinsal.length === 0;

  return (
    <section className="ms-card" aria-labelledby="ms-relation-title">
      <header className="ms-card-head">
        <h2 id="ms-relation-title">글자끼리 걸린 것</h2>
        <p>합·충·형과 신살, 그리고 많이 나온 십성입니다.</p>
      </header>

      <div className="ms-chips">
        {dominantTenGods.map((tenGod) => (
          <span key={tenGod} className="ms-chip ms-chip--plain">
            십성 {tenGod}
          </span>
        ))}
        {notableRelations.map((relation) => (
          <span key={`${relation.kind}-${relation.label}`} className="ms-chip">
            {relation.label}
            <i>{relation.pillarPositions.join("·")}</i>
          </span>
        ))}
        {xing.map((relation) => (
          <span key={`xing-${relation.branches.join("")}`} className="ms-chip">
            {relation.branches.join("")}형
            <i>{relation.pillarPositions.join("·")}</i>
          </span>
        ))}
        {shinsal.map((fact) => (
          <span key={fact.name} className="ms-chip">
            {fact.name}
            <i>{fact.positions.join("·")}</i>
          </span>
        ))}
      </div>

      {nothing && <p className="ms-note">합·충·형과 신살은 걸린 것이 없습니다.</p>}
    </section>
  );
}

function MajorLuck({ data }: { data: Manseryeok }) {
  const { direction, startAge, columns } = data.majorLuck;
  return (
    <section className="ms-card" aria-labelledby="ms-luck-title">
      <header className="ms-card-head">
        <h2 id="ms-luck-title">대운</h2>
        <p>
          {direction} · {startAge}세부터 10년마다 한 칸씩 옮겨 갑니다.
        </p>
      </header>

      {/* 여덟 칸이 좁은 화면을 넘으므로 이 표만 가로로 스크롤한다. */}
      <div className="ms-luck-scroll">
        <div className="ms-luck">
          {columns.map((column) => (
            <div key={column.fromAge} className={`ms-luck-col ${column.current ? "on" : ""}`}>
              <span className="ms-luck-age">{column.fromAge}세</span>
              <GlyphCell glyph={column.stem} size="sm" />
              <GlyphCell glyph={column.branch} size="sm" />
              <span className="ms-luck-meta">{column.stem.tenGod}</span>
              <span className="ms-luck-meta ms-luck-year">{column.fromYear}년</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ms-summary">
        <div>
          <span>올해 세운</span>
          <strong>
            {data.facts.luckContext.yearly.pillar} · {data.facts.luckContext.yearly.tenGod}
          </strong>
        </div>
        <div>
          <span>이달 월운</span>
          <strong>
            {data.facts.luckContext.monthly.pillar} · {data.facts.luckContext.monthly.tenGod}
          </strong>
        </div>
        <div>
          <span>오늘 일진</span>
          <strong>
            {data.today.pillar} · {data.today.tenGod}
          </strong>
        </div>
      </div>
    </section>
  );
}

function Notes({ data }: { data: Manseryeok }) {
  return (
    <section className="ms-card ms-card--quiet" aria-labelledby="ms-note-title">
      <header className="ms-card-head">
        <h2 id="ms-note-title">계산 기준</h2>
      </header>
      <ul className="ms-notes">
        {data.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        <li>연·월의 경계는 달력이 아니라 절기로 잡습니다 (입춘부터 새해).</li>
        {data.lunar && (
          <li>
            음력으로는 {data.lunar.year}년 {data.lunar.month}월 {data.lunar.day}일
            {data.lunar.leapMonth ? " (윤달)" : ""}입니다.
          </li>
        )}
      </ul>
    </section>
  );
}

export default async function ManseryeokPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = parseManseryeokQuery(raw);
  const data = query ? buildManseryeok(query) : null;
  // 입력은 왔는데 명식이 안 나온 경우는 하나뿐이다 — 그 달에 없는 음력 날짜.
  const badLunar = query !== null && data === null;

  return (
    <main className="ms">
      <header className="ms-hero">
        <span className="badge">무료 · 회원가입 없음</span>
        <h1 className="ms-h1">
          만세력
          <TermSheet pages={MANSERYEOK_TERMS} label="만세력 용어 설명" />
        </h1>
        <p className="ms-lede">
          생년월일시를 넣으면 사주 원국과 십성·지장간·오행·신살·대운을 바로 계산합니다.
          음력과 윤달, 진태양시 보정까지 반영합니다.
        </p>
      </header>

      <ManseryeokForm initial={query} />

      {badLunar && (
        <p className="ms-error" role="alert">
          그 음력 날짜는 없는 날이에요. 윤달 여부와 일자를 다시 확인해주세요.
        </p>
      )}

      {data && (
        <div className="ms-result">
          <Chart data={data} />
          <Elements data={data} />
          <Relations data={data} />
          <MajorLuck data={data} />
          <Notes data={data} />

          <section className="ms-cta card">
            <h2>판은 나왔는데, 그래서 무슨 뜻일까요?</h2>
            <p>
              여기까지가 계산입니다. 이 명식이 연애와 인연에서 어떻게 움직이는지는
              무료 미리보기에서 이어서 볼 수 있어요.
            </p>
            <Link className="ms-cta-btn" href="/saju/inner-mind">
              내 속마음 무료로 보기
            </Link>
            <Link className="ms-cta-link" href="/saju/compatibility">
              둘의 궁합이 궁금하다면 →
            </Link>
          </section>
        </div>
      )}

      <section className="ms-card ms-card--quiet ms-about">
        <h2>만세력이 무엇을 보여주나요</h2>
        <dl>
          <dt>명식 (원국)</dt>
          <dd>
            태어난 연·월·일·시를 각각 천간과 지지 두 글자로 세운 여덟 글자입니다. 흔히
            사주팔자라고 부르는 그 여덟 글자예요.
          </dd>
          <dt>십성</dt>
          <dd>
            일간(태어난 날의 천간)을 기준으로 나머지 글자가 어떤 관계에 놓이는지 이름을 붙인
            것입니다. 비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인 열 가지예요.
          </dd>
          <dt>지장간</dt>
          <dd>지지 한 글자 속에 숨어 있는 천간입니다. 겉으로 안 보이는 오행이 여기 들어 있어요.</dd>
          <dt>대운</dt>
          <dd>
            10년 단위로 바뀌는 흐름입니다. 월주에서 출발하고, 순행인지 역행인지는 태어난 해의
            천간 음양과 성별로 갈립니다.
          </dd>
        </dl>
        <p className="ms-disclaimer">
          계산은 결정론적입니다 — 같은 생년월일시에는 언제나 같은 값이 나옵니다.
          해석은 오락 목적의 콘텐츠입니다.
        </p>
      </section>
    </main>
  );
}

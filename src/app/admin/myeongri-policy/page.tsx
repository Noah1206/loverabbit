// 고급 명리 정책 — 운영자가 무엇을 승인해야 하는지 한 화면에서 본다.
//
// 이 화면의 목적은 "켜기"가 아니라 "무엇이 막고 있는지 보기"다. 그래서 승인 버튼이
// 없다. 상태를 올리는 일은 정책 파일을 고치고 커밋하는 일이고, 그 커밋에 누가 무엇을
// 확인했는지가 남아야 한다. 화면에서 클릭 한 번으로 켜지면 그 흔적이 안 남는다.

import { buildPolicyBoard } from "@/lib/myeongri-policy/policy-board";
import { axisLabel } from "@/lib/myeongri/yongsin";

export const dynamic = "force-dynamic";

const MODE_NOTE: Record<string, string> = {
  evidence_only: "계산·감사·이 화면에만. 사용자 리포트의 결론도 강약 라벨도 바꾸지 않는다.",
  policy_preview: "승인된 출처 정책 범위에서만, 리포트의 고급 해석 미리보기 구간에.",
  policy_enabled: "출처·가중치·우선순위·회귀 세트가 모두 승인된 뒤에만.",
};

export default function MyeongriPolicyPage() {
  const board = buildPolicyBoard();
  const advanced = board.sample?.advanced;

  return (
    <main style={S.page}>
      <h1 style={S.h1}>고급 명리 정책</h1>
      <p style={S.lede}>
        조후·격국·용신은 틀려도 드러나지 않는 층입니다. 만세력은 다른 만세력과 대조하면
        알 수 있지만, &ldquo;용신은 화&rdquo;는 학설이 갈리는 자리라 반증할 데가 없습니다.
        그래서 이 화면에는 승인 버튼이 없습니다 — 상태를 올리는 일은 정책 파일을 고치고
        그 커밋에 무엇을 확인했는지 남기는 일입니다.
      </p>

      <section style={S.card}>
        <h2 style={S.h2}>현재 모드</h2>
        <p style={S.mode}>
          <code>ADVANCED_MYEONGRI_MODE={board.mode}</code>
        </p>
        <p style={S.note}>{MODE_NOTE[board.mode]}</p>
        <p style={S.note}>출처 정책 판: {board.sourcePolicyVersion}</p>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>승인 순서</h2>
        <ol style={S.ol}>
          {board.approvalOrder.map((step) => (
            <li key={step.step} style={S.li}>
              <strong>{step.done ? "완료" : "대기"}</strong> · {step.what}
              <div style={S.note}>{step.why}</div>
            </li>
          ))}
        </ol>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>출처</h2>
        <Table
          head={["ID", "제목", "종류", "판본/위치", "권리", "결론 근거로 쓸 수 있나"]}
          rows={board.sources.map((s) => [
            s.sourceId,
            s.title,
            s.sourceType,
            `${s.edition} · ${s.locator}`,
            s.rightsStatus,
            s.usable ? "예" : "아니오",
          ])}
        />
        <p style={S.note}>
          metadata_only는 &ldquo;그 책이 이 주제를 다룬다&rdquo;까지만 안다는 뜻입니다. 그 상태로
          표를 채우면, 채운 사람이 정한 것이 고전에서 온 것처럼 보이게 됩니다.
        </p>
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>정책 표</h2>
        <Table
          head={["표", "판", "상태", "남은 물음"]}
          rows={board.tables.map((t) => [
            t.name,
            t.version,
            t.status,
            t.openQuestions.length ? `${t.openQuestions.length}건` : "-",
          ])}
        />
        {board.tables
          .filter((t) => t.openQuestions.length > 0)
          .map((t) => (
            <details key={t.name} style={S.details}>
              <summary>{t.name} — 남은 물음</summary>
              <ul style={S.ul}>
                {t.openQuestions.map((q) => (
                  <li key={q} style={S.li}>
                    {q}
                  </li>
                ))}
              </ul>
            </details>
          ))}
      </section>

      <section style={S.card}>
        <h2 style={S.h2}>축 충돌 우선순위</h2>
        <Table
          head={["정책", "상태", "상황", "순서", "막고 있는 것"]}
          rows={board.conflictPolicies.map((p) => [
            p.policyId,
            p.status,
            p.scenario,
            p.priorityOrder.map(axisLabel).join(" > "),
            p.blockedBy ?? "-",
          ])}
        />
      </section>

      {board.pendingPartnerRuleIds.length > 0 && (
        <section style={S.card}>
          <h2 style={S.h2}>승인 대기 중인 상대 규칙</h2>
          <Table
            head={["규칙", "막고 있는 것"]}
            rows={board.pendingPartnerRuleIds.map((r) => [r.id, r.blockedBy])}
          />
        </section>
      )}

      {advanced && board.sample && (
        <section style={S.card}>
          <h2 style={S.h2}>기준 명식으로 본 지금 상태</h2>
          <p style={S.note}>
            {board.sample.label} · {board.sample.fourPillars} · {board.sample.strength}
          </p>

          <h3 style={S.h3}>계절 (계산층 — 출처 없이 확정 가능)</h3>
          <p style={S.mono}>
            {advanced.seasonalContext.monthBranch}월 ·{" "}
            {advanced.seasonalContext.solarTermWindow.birthSolarTerm}+
            {advanced.seasonalContext.solarTermWindow.daysIntoTerm}일 ·{" "}
            {advanced.seasonalContext.solarTermWindow.season} ·{" "}
            {advanced.seasonalContext.climateAxes.temperature}/
            {advanced.seasonalContext.climateAxes.moisture}
          </p>

          <h3 style={S.h3}>격국</h3>
          <p style={S.mono}>
            {advanced.gyeokguk.determination} · {advanced.gyeokguk.status} · 대표{" "}
            {advanced.gyeokguk.primary?.pattern ?? "없음"}
          </p>
          <Table
            head={["후보", "확신", "근거"]}
            rows={advanced.gyeokguk.candidates.map((c) => [
              c.pattern,
              c.confidence,
              c.basis.join(" / "),
            ])}
          />
          <ul style={S.ul}>
            {advanced.gyeokguk.exclusions.map((x) => (
              <li key={x.pattern} style={S.li}>
                <strong>{x.pattern}</strong> — {x.reason}
              </li>
            ))}
          </ul>

          <h3 style={S.h3}>조후 후보</h3>
          <Table
            head={["오행", "역할", "무게", "상태", "명식에 있나", "막고 있는 것"]}
            rows={advanced.johu.candidates.map((c) => [
              c.candidateElement,
              c.role,
              c.priority,
              c.status,
              c.presentInChart ? "있음" : "없음",
              c.blockers[0] ?? "-",
            ])}
          />

          <h3 style={S.h3}>용신 후보 (축별)</h3>
          <Table
            head={["축", "후보", "합의"]}
            rows={(Object.keys(advanced.yongsin.candidatesByAxis) as Array<
              keyof typeof advanced.yongsin.candidatesByAxis
            >).map((axis) => [
              axisLabel(axis),
              advanced.yongsin.candidatesByAxis[axis]
                .map((c) => `${c.element}(${c.rank}/${c.status})`)
                .join(" ") || "후보 없음",
              "",
            ])}
          />
          <p style={S.mono}>
            consensus: {advanced.yongsin.consensus.kind} — {advanced.yongsin.consensus.reason}
          </p>
          <p style={S.mono}>finalOutput: {advanced.yongsin.finalOutput.status}</p>

          <h3 style={S.h3}>충돌</h3>
          {advanced.conflicts.length === 0 ? (
            <p style={S.note}>없음</p>
          ) : (
            <Table
              head={["ID", "무게", "처리", "내용", "설명"]}
              rows={advanced.conflicts.map((c) => [
                c.id,
                c.severity,
                c.resolutionStatus,
                c.subject,
                c.explanation,
              ])}
            />
          )}

          <h3 style={S.h3}>사용자에게 나가지 못하는 이유</h3>
          <ul style={S.ul}>
            {advanced.suppressionReasons.map((r) => (
              <li key={r} style={S.li}>
                {r}
              </li>
            ))}
          </ul>

          <h3 style={S.h3}>trace ({advanced.trace.length}건)</h3>
          <Table
            head={["규칙", "판정", "출처", "이유"]}
            rows={advanced.trace.map((t) => [
              t.ruleId,
              t.verdict,
              t.sourceIds.join(", ") || "-",
              t.reason,
            ])}
          />
        </section>
      )}
    </main>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={S.scroll}>
      <table style={S.table}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={S.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={S.td}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px", lineHeight: 1.6 },
  h1: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  h2: { fontSize: 17, fontWeight: 700, marginBottom: 10 },
  h3: { fontSize: 14, fontWeight: 700, margin: "18px 0 8px" },
  lede: { fontSize: 14, opacity: 0.85, marginBottom: 24 },
  card: {
    border: "1px solid rgba(128,128,128,0.28)",
    borderRadius: 0,
    padding: "18px 18px 20px",
    marginBottom: 18,
  },
  mode: { fontSize: 15, margin: "4px 0" },
  note: { fontSize: 12.5, opacity: 0.72, margin: "4px 0", whiteSpace: "pre-wrap" },
  mono: { fontFamily: "ui-monospace, monospace", fontSize: 12.5, margin: "4px 0" },
  scroll: { overflowX: "auto", margin: "8px 0" },
  table: { borderCollapse: "collapse", width: "100%", fontSize: 12.5 },
  th: {
    textAlign: "left",
    padding: "6px 8px",
    borderBottom: "1px solid rgba(128,128,128,0.4)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "6px 8px",
    borderBottom: "1px solid rgba(128,128,128,0.16)",
    verticalAlign: "top",
  },
  ul: { margin: "6px 0 0 18px", fontSize: 12.5 },
  ol: { margin: "6px 0 0 18px", fontSize: 13 },
  li: { marginBottom: 6 },
  details: { fontSize: 12.5, marginTop: 8 },
};

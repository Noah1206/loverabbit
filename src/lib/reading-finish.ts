// 결제가 확인된 뒤에 유료 본문을 마저 만든다.
//
// 발급(/api/reading)은 미리보기에 필요한 절까지만 만든다. 결제하지 않는 사람의
// 유료 본문을 만드느라 돈을 태우지 않기 위해서다. 그 나머지를 여기서 잇는다.
//
// 순서가 중요하다: 권리 확정(결제 검증 + markUnlocked) -> 생성 -> 저장.
// 생성이 먼저면 돈을 받기 전에 만들게 되고, 저장이 먼저면 반쪽을 판 것이 된다.
// 생성이 실패해도 리딩은 해금 상태로 남으므로, 다시 열면 이 함수가 한 번 더 시도한다.

import { chatComplete, type Provider } from "@/lib/ai";
import { PRODUCT_MAP } from "@/lib/products";
import {
  composeReport,
  continuityFromReport,
  rewriteFlagged,
  type Complete,
} from "@/lib/reading-compose";
import { READING_RULES, forbiddenFromRules } from "@/lib/reading-rules";
import { approvedPartnerRules } from "@/lib/myeongri-policy/partner-rules";
import {
  READING_PROMPT_VERSION,
  reportToText,
  type StructuredReport,
} from "@/lib/reading-prompt";
import { checkReport, flaggedSections } from "@/lib/reading-guard";
import { clearResume, loadResume, saveResume, type ResumeInput } from "@/lib/reading-resume";
import { getReading, saveReading, type StoredReading } from "@/lib/store";
import { recordAiUsage } from "@/lib/ai-usage";

export interface FinishResult {
  full: string;
  report: StructuredReport | null;
  /** 본문을 아직 다 못 만들었다. 호출부는 이걸로 503을 낸다. */
  incomplete: boolean;
  /** 이번 호출이 실제로 나머지를 만들었는가 (로그·계측용) */
  generated: boolean;
}

/**
 * 리딩을 완성해서 돌려준다.
 *
 * 이미 다 만들어져 있거나(재조회), 재개 정보가 없는 옛 리딩이면 저장된 것을 그대로 쓴다.
 * 모자랄 때만 나머지를 만들고, 성공하면 전문을 DB에 써서 다음부터는 만들지 않게 한다.
 */
export async function finishReading(params: {
  readingId: string;
  stored: StoredReading | null;
  /** 발급 때 봉인해 둔 부분 리포트 (클라이언트 blob에서 나온다) */
  partialReport: StructuredReport | null;
  storedFull: string;
  /** 모델 호출부 — 검증에서 갈아끼우기 위한 자리. 생략하면 실제 생성기를 쓴다. */
  complete?: Complete;
}): Promise<FinishResult> {
  const { readingId, stored, storedFull } = params;
  const suppliedPartial = params.partialReport;
  const category = stored?.category ?? "";
  const catalogOutline = PRODUCT_MAP[category]?.toc ?? [];

  // 목차를 모르거나(옛 상품) 이미 다 있으면 손대지 않는다.
  if (catalogOutline.length === 0 || (suppliedPartial && suppliedPartial.sections.length >= catalogOutline.length)) {
    return { full: storedFull, report: suppliedPartial, incomplete: false, generated: false };
  }

  let resume;
  try {
    resume = await loadResume(readingId);
  } catch (error) {
    console.error("재개 정보 조회 실패:", error);
    return { full: storedFull, report: suppliedPartial, incomplete: true, generated: false };
  }

  // 재개 정보가 없다 = 미뤄 생성 이전에 발급된 리딩. 그때는 전문을 다 만들어 저장했다.
  if (!resume) {
    return { full: storedFull, report: suppliedPartial, incomplete: false, generated: false };
  }

  // 브라우저 blob과 서버 재개 정보 중 더 많이 완성된 것을 쓴다. 서버 사본이 있어야
  // 무료 미리보기를 만든 기기와 결제하는 기기가 달라도 첫 절을 재생성하지 않는다.
  const partialReport = [suppliedPartial, resume.partialReport ?? null]
    .filter((report): report is StructuredReport => Boolean(report))
    .sort((a, b) => b.sections.length - a.sections.length)[0] ?? null;
  const outline = resume.outline?.length ? resume.outline : catalogOutline;
  const done = partialReport?.sections.length ?? 0;

  if (partialReport && done >= outline.length) {
    return { full: storedFull, report: partialReport, incomplete: false, generated: false };
  }
  if (resume.doneSections > done) {
    console.warn(
      `리딩 ${readingId}: 완료 수는 ${resume.doneSections}절인데 복원할 구조화 본문은 ${done}절뿐이라 ` +
        `없는 절부터 다시 만듭니다.`
    );
  }
  if (resume.promptVersion && resume.promptVersion !== READING_PROMPT_VERSION) {
    console.warn(
      `리딩 ${readingId}: 무료 초안 프롬프트 ${resume.promptVersion}, 현재 ${READING_PROMPT_VERSION}. ` +
        `저장된 첫 절과 연속성 상태는 그대로 유지합니다.`
    );
  }

  const resumeProvider = validProvider(resume.provider);
  const complete: Complete =
    params.complete ??
    ((system, user, budget, callOptions) =>
      chatComplete(system, [{ role: "user", content: user }], budget, {
        thinking: false,
        json: true,
        ...(resumeProvider ? { provider: resumeProvider } : {}),
        ...(resume.model ? { model: resume.model } : {}),
        ...callOptions,
      }));

  // 발급 시점에 켜졌던 규칙을 그대로 복원한다. 그 사이 규칙 표현을 고쳤더라도
  // 산 사람이 산 리딩은 발급 때의 해석으로 이어져야 한다.
  const byId = new Map(
    [...READING_RULES, ...approvedPartnerRules()].map((rule) => [rule.id, rule])
  );
  const matchedRules = resume.ruleIds.map((id) => byId.get(id)).filter((rule) => rule !== undefined);

  // 발급 때 봉인한 지수. 옛 리딩에는 없을 수 있다 — 그때는 숫자 없이 쓴다.
  const seal = stored?.scoreSeal ?? null;

  // 다시 쓰기도 같은 입력을 써야 한다. 여기서 한 번 만들어 둘 다 쓴다 —
  // 따로 만들면 now 나 occupation 이 어긋나 앞뒤 절이 다른 무대에서 논다.
  const readingInput = {
      facts: resume.facts,
      partnerFacts: resume.partnerFacts,
      matchedRules,
      // 발급 때 좁힌 이름이 있으면 그것. 옛 재개 정보는 상품표로 돌아간다.
      productLabel: resume.productLabel ?? PRODUCT_MAP[category]?.promptLabel ?? category,
      // 결제 뒤 이어 쓰는 절도 같은 물음에 답해야 한다. 여기서 빠지면 앞 절과
      // 뒤 절이 서로 다른 상품처럼 읽힌다.
      productId: category,
      // 발급 때 봉인해 둔 숫자를 그대로 쓴다. 다시 계산하지 않는다 — 운을 보는
      // 인자가 섞여 있어 배합표를 고치거나 해가 바뀌면 다른 값이 나오고, 그러면
      // 앞 절과 뒤 절이 서로 다른 지수를 말하게 된다. 화면이 보여주는 것도 봉인이다.
      score: seal
        ? {
            value: seal.value,
            label: seal.label ?? PRODUCT_MAP[category]?.scoreLabel ?? null,
            band: seal.band ?? PRODUCT_MAP[category]?.meterLabels?.[seal.bandIndex] ?? null,
            factors: seal.factors.map((f) => ({ label: f.label, delta: f.delta, basis: f.basis })),
          }
        : null,
      outline,
      focus: resume.partnerFacts ? "relationship" : "self",
      currentScene: resume.currentScene,
      // 발급 때와 같은 무대에서 이어 쓴다. 앞 절과 뒤 절의 장면이 달라지면 안 된다.
      occupation: resume.occupation,
      characterId: null,
      characterName: null,
      // 대운·세운은 발급 시점 기준이어야 앞 절과 뒷 절이 같은 해를 말한다
      now: new Date(resume.issuedAt),
  };

  const rest = await composeReport(readingInput, complete, {
    doneSections: done,
    continuity: resume.continuity ?? (partialReport ? continuityFromReport(partialReport) : undefined),
  });

  // 결제 뒤에 만든 몫. 무료에서 확정한 머리와 첫 절은 이 원가에 다시 들어가지 않는다.
  void recordAiUsage({
    readingId,
    stage: "unlock",
    category,
    provider: rest.provider,
    model: rest.model,
    calls: rest.requestCount,
    usage: rest.usage,
  });

  // 머리는 발급 때 만든 것이 있으면 그것, 없으면 방금 만든 것을 쓴다.
  const head = partialReport ?? rest.report;
  if (!head) {
    console.error(`리딩 ${readingId}: 머리를 만들지 못해 본문을 이을 수 없음`);
    return { full: storedFull, report: null, incomplete: true, generated: true };
  }
  const sections = [...(partialReport?.sections ?? []), ...rest.sections];
  const report: StructuredReport = { ...head, sections };
  const { full } = reportToText(report);

  if (sections.length < outline.length) {
    console.error(
      `리딩 ${readingId} 본문 미완성: ${sections.length}/${outline.length} (실패 조각: ${rest.failedParts.join(", ") || "불명"})`
    );
    // 만들어진 것까지는 저장해 둔다. 다음 시도는 그만큼을 건너뛴다.
    if (sections.length > done) {
      await persist(stored, full);
      await persistResumeProgress(readingId, resume, report, rest.model);
    }
    return { full, report, incomplete: true, generated: true };
  }

  // 여기서부터는 표현 문제만 남는다. 팔 수 없는 수준은 위에서 걸렀다.
  const guard = checkReport(report, {
    expectedSections: outline.length,
    forbiddenClaims: forbiddenFromRules(matchedRules),
    facts: resume.facts,
    partnerFacts: resume.partnerFacts,
    matchedRules,
    productDomain: category,
    scoreValue: seal?.value ?? null,
  });
  const blocking = guard.violations.filter((v) => v.blocking);
  if (blocking.length > 0) {
    console.warn(`리딩 ${readingId} 출고 검사 위반:`, blocking.map((v) => `${v.where} ${v.detail}`).join(" / "));

    // 전문이 다 모인 지금이 계절 반복처럼 리포트 전체를 두고 세는 지적이 실제로
    // 걸리는 자리다. 미리보기 때는 절이 둘뿐이라 애초에 안 걸린다.
    // 걸린 절만 다시 받는다 — 산 사람이 볼 글이므로 여기서 그냥 넘기면 안 된다.
    const flagged = flaggedSections(guard.violations, sections.map((section) => section.title));
    if (flagged.length > 0) {
      const redone = await rewriteFlagged(readingInput, complete, flagged);
      // 다시 쓴 절도 값이 든다. 이 몫을 안 세면 "왜 청구서가 더 나왔나" 가 안 풀린다.
      void recordAiUsage({
        readingId,
        stage: "rewrite",
        category,
        model: rest.model,
        calls: redone.requestCount,
        usage: redone.usage,
      });
      for (const section of redone.sections) {
        const at = sections.findIndex((item) => item.title === section.title);
        if (at >= 0) sections[at] = section;
      }
      if (redone.sections.length > 0) {
        const left = checkReport(report, {
          expectedSections: outline.length,
          forbiddenClaims: forbiddenFromRules(matchedRules),
          facts: resume.facts,
          partnerFacts: resume.partnerFacts,
          matchedRules,
          productDomain: category,
          scoreValue: seal?.value ?? null,
        }).violations.filter((v) => v.blocking);
        console.warn(
          left.length === 0
            ? `리딩 ${readingId} 다시 쓴 절 ${redone.sections.length}개로 막는 위반이 사라졌습니다.`
            : `리딩 ${readingId} 다시 썼는데도 남은 위반: ${left.map((v) => `${v.where} ${v.detail}`).join(" / ")}`
        );
      }
    }
  }

  // 완성된 리포트에서 티저를 다시 뽑는다 - 이제 머리와 몸이 같은 글에서 나온다.
  await persist(stored, full, report ? reportToText(report).teaser : undefined);
  await clearResume(readingId);
  return { full, report, incomplete: false, generated: true };
}

function validProvider(provider: Provider | undefined): Provider | undefined {
  return provider === "openai" ||
    provider === "anthropic" ||
    provider === "gemini" ||
    provider === "claude-code"
    ? provider
    : undefined;
}

/** 실패한 조각이 있어도 성공한 절은 서버에 남겨 다음 결제 재조회에서 반복 생성하지 않는다. */
async function persistResumeProgress(
  readingId: string,
  resume: ResumeInput,
  report: StructuredReport,
  model: string
): Promise<void> {
  try {
    await saveResume(readingId, {
      ...resume,
      doneSections: report.sections.length,
      partialReport: report,
      continuity: continuityFromReport(report),
      ...(model ? { model } : {}),
      promptVersion: resume.promptVersion ?? READING_PROMPT_VERSION,
    });
  } catch (error) {
    // 전문 저장과 마찬가지로 이번 응답을 막지는 않는다. 다만 다음 시도에서 같은 절을
    // 다시 만들 수 있으므로 비용 장부에서 찾을 수 있게 남긴다.
    console.error(`리딩 ${readingId} 재개 진행 저장 실패:`, error);
  }
}

/**
 * 완성된 전문을 DB에 쓴다. 이 뒤로는 재개 정보 없이도 전문을 돌려줄 수 있다.
 *
 * 반드시 지금 저장된 것을 다시 읽어 그 위에 얹는다. 호출부(/api/unlock)가 들고 있는
 * stored는 결제 처리 *전*에 읽은 것이라, 그대로 upsert하면 방금 해금한 리딩이
 * unlocked=false로 되돌아가고 결제 기록이 지워진다.
 *
 * 저장에 실패해도 이번 응답은 내보낸다 — 사용자는 이미 돈을 냈고, 글은 손에 있다.
 * 저장이 안 됐으면 다음 조회에서 다시 만들게 되므로 잃는 것은 비용뿐이다.
 */
async function persist(stored: StoredReading | null, full: string, teaser?: string): Promise<void> {
  if (!stored) return;
  try {
    const current = (await getReading(stored.id)) ?? stored;
    // 티저도 같이 갈아 끼운다.
    //
    // 완성된 리포트의 티저를 같이 저장해 목록·결제 화면도 같은 확정 머리를 쓰게 한다.
    await saveReading({ ...current, full, ...(teaser ? { teaser } : {}) });
  } catch (error) {
    console.error("완성된 리딩 저장 실패:", error);
  }
}

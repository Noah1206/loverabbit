"use client";

import { useCallback, useEffect, useState } from "react";

import { getUser } from "@/lib/user";
import type { FortuneType, WebtoonPanelData } from "@/lib/webtoon-saju";

// 웹툰 사주 화면의 데이터 훅. 잔액·해금 상태는 항상 서버 응답을 정본으로 쓴다 —
// 클라이언트에서 balance -= cost 같은 직접 차감을 하지 않는다.

export interface WebtoonReadingState {
  readingId: string;
  fortuneType: FortuneType;
  subjectNickname: string;
  unlocked: boolean;
  luvitCost: number;
  luvitBalance: number;
  coverImageUrl: string;
  previewText: string;
  previewPoints: string[];
  panels: WebtoonPanelData[];
  fullText?: string[];
}

export function useWebtoonReading(readingId: string, fortuneType: FortuneType) {
  const [reading, setReading] = useState<WebtoonReadingState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "signin">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const user = getUser();
    if (!user) {
      setStatus("signin");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/webtoon-readings/${encodeURIComponent(readingId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: user.token, fortuneType }),
      });
      if (res.status === 401) {
        setStatus("signin");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError((data as { error?: string } | null)?.error ?? "불러오지 못했어요.");
        setStatus("error");
        return;
      }
      setReading(data as WebtoonReadingState);
      setStatus("ready");
    } catch {
      setError("네트워크 오류가 발생했어요.");
      setStatus("error");
    }
  }, [readingId, fortuneType]);

  useEffect(() => {
    if (readingId) void load();
  }, [readingId, load]);

  /* 응답이 오지 않을 때 화면이 부른다 — 로딩에 갇히지 않고 에러 화면으로
     넘어가면 거기엔 재시도와 홈이 있다. */
  const giveUp = useCallback(() => {
    setStatus((current) => (current === "loading" ? "error" : current));
    setError((current) => current ?? "응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.");
  }, []);

  return { reading, status, error, reload: load, applyServerState: setReading, giveUp };
}

export interface UnlockResult {
  unlocked: boolean;
  newBalance: number;
  transactionId: string;
  panels: WebtoonPanelData[];
  fullText: string[];
}

export async function unlockWebtoonReading(input: {
  readingId: string;
  fortuneType: FortuneType;
  expectedCost: number;
  idempotencyKey: string;
}): Promise<UnlockResult> {
  const user = getUser();
  const response = await fetch(`/api/webtoon-readings/${encodeURIComponent(input.readingId)}/unlock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      userToken: user?.token,
      fortuneType: input.fortuneType,
      expectedCost: input.expectedCost,
    }),
  });

  if (response.status === 402) throw new Error("INSUFFICIENT_LUVIT");
  if (response.status === 401) throw new Error("SIGNIN_REQUIRED");
  if (response.status === 404) throw new Error("WEBTOON_READING_FORBIDDEN");
  if (response.status === 409) throw new Error("PRICE_CHANGED");
  if (!response.ok) throw new Error("WEBTOON_UNLOCK_FAILED");
  return (await response.json()) as UnlockResult;
}

export function useWebtoonUnlock(readingId: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(
    async (fortuneType: FortuneType, expectedCost: number) => {
      if (pending) return { ok: false as const };
      setPending(true);
      setError(null);
      try {
        const result = await unlockWebtoonReading({
          readingId,
          fortuneType,
          expectedCost,
          idempotencyKey: crypto.randomUUID(),
        });
        return { ok: true as const, result };
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "UNKNOWN_ERROR";
        setError(message);
        return { ok: false as const, error: message };
      } finally {
        setPending(false);
      }
    },
    [readingId, pending]
  );

  return { unlock, pending, error };
}

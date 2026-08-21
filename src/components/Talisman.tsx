"use client";

// 마지막 장의 부적 — 다 읽고 나서 가져가는 것.
//
// 처음에는 덮여 있고 "부적받기" 를 눌러야 열린다. 그냥 띄워 두면 마지막 장의 그림 한 장일
// 뿐인데, 한 번 누르게 하면 받는 일이 된다. 그 한 번이 저장까지 이어진다.
//
// 저장이 까다로운 자리다. 운영에서는 그림이 Storage(다른 도메인)에 있어서 <a download>
// 가 그냥 무시되고 새 탭만 열린다. 그래서 파일을 직접 받아 blob 으로 만든 뒤 내려준다.
// 모바일에서는 공유 시트가 앨범 저장까지 이어지므로 그쪽을 먼저 시도한다.

import { useCallback, useState } from "react";
import type { ReadingImage } from "@/lib/reading-images";

type SaveState = "idle" | "saving" | "done" | "failed";

export default function Talisman({ image, label }: { image?: ReadingImage | null; label: string }) {
  const [opened, setOpened] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const save = useCallback(async () => {
    if (!image?.url) return;
    setSaveState("saving");
    try {
      const res = await fetch(image.url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const filename = `${label.replace(/[\/:*?"<>|]/g, "")}_부적.png`;

      // 모바일: 공유 시트에서 '이미지 저장' 으로 이어진다. 다운로드보다 이쪽이 자연스럽다.
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${label} 부적` });
        setSaveState("done");
        return;
      }

      // 데스크톱: blob 이면 같은 출처라 download 속성이 실제로 먹는다
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      setSaveState("done");
    } catch (e) {
      // 사용자가 공유 시트를 닫은 것도 여기로 온다. 실패로 몰아세우지 않는다.
      if (e instanceof DOMException && e.name === "AbortError") {
        setSaveState("idle");
        return;
      }
      setSaveState("failed");
    }
  }, [image?.url, label]);

  // 아직 안 만들어졌거나 실패했으면 이 자리를 아예 두지 않는다.
  // 빈 액자를 남기면 "받을 게 있었는데 못 받았다" 로 읽힌다.
  if (!image || image.status === "failed") return null;

  return (
    <section className="rv-talisman">
      <h2>부적 한 장 받아 가요</h2>
      <p>이 명식의 기운으로 뜬 부적이에요. 저장해서 간직하세요.</p>

      <div className="rv-talisman-frame" data-opened={opened ? "yes" : "no"}>
        {image.status === "ready" && opened ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.alt ?? `${label} 부적`} />
        ) : (
          <div className="rv-talisman-back" aria-hidden />
        )}
      </div>

      {!opened ? (
        <button
          type="button"
          className="btn rv-talisman-open"
          onClick={() => setOpened(true)}
          disabled={image.status !== "ready"}
        >
          {image.status === "ready" ? "부적받기" : "부적을 뜨는 중이에요…"}
        </button>
      ) : (
        <button type="button" className="btn rv-talisman-open" onClick={() => void save()} disabled={saveState === "saving"}>
          {saveState === "saving"
            ? "저장하는 중…"
            : saveState === "done"
              ? "저장했어요 ✓"
              : saveState === "failed"
                ? "다시 저장해보기"
                : "이미지로 저장하기"}
        </button>
      )}

      {saveState === "failed" && (
        <p className="rv-talisman-hint">
          저장이 막혔어요. 그림을 길게 눌러 저장할 수도 있어요.
        </p>
      )}
    </section>
  );
}

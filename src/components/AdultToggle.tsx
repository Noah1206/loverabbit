"use client";

import { useState } from "react";

import { useTheme } from "@/components/ThemeProvider";

// 헤더의 19금 스위치.
//
// 켤 때는 한 번 묻고, 끌 때는 묻지 않는다 - 들어가는 문에만 자물쇠를 단다.
// 나이 확인은 이 화면이 아니라 결제·본인확인 쪽에서 할 일이고, 여기서 하는 것은
// "보겠다고 스스로 눌렀다" 를 남기는 것이다.
export default function AdultToggle({ compact = false }: { compact?: boolean }) {
  const { adultMode, setAdultMode } = useTheme();
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`adult-toggle${adultMode ? " is-on" : ""}${compact ? " is-compact" : ""}`}
        aria-pressed={adultMode}
        aria-label={adultMode ? "성인 연출 끄기" : "성인 연출 켜기"}
        title={adultMode ? "성인 연출 켜짐" : "성인 연출 꺼짐"}
        onClick={() => (adultMode ? setAdultMode(false) : setAsking(true))}
      >
        <span className="adult-toggle-badge" aria-hidden>
          19
        </span>
        {!compact && <span className="adult-toggle-text">{adultMode ? "ON" : "OFF"}</span>}
      </button>

      {asking && (
        <div className="adult-gate-backdrop" role="dialog" aria-modal="true" aria-label="성인 연출 확인">
          <div className="adult-gate card">
            <span className="adult-gate-badge" aria-hidden>
              19
            </span>
            <h2>성인 연출을 켤까요?</h2>
            <p>
              신당 캐릭터의 연출 수위가 올라갑니다. 만 19세 이상만 이용할 수 있어요.
              언제든 헤더의 <strong>19</strong> 버튼으로 다시 끌 수 있습니다.
            </p>
            <div className="adult-gate-actions">
              <button type="button" className="adult-gate-no" onClick={() => setAsking(false)}>
                아니요
              </button>
              <button
                type="button"
                className="adult-gate-yes"
                onClick={() => {
                  setAdultMode(true);
                  setAsking(false);
                }}
              >
                만 19세 이상입니다
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

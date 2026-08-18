"use client";

import { useEffect, useRef, useState } from "react";

const AUDIO_PREFERENCE_KEY = "loverabbit:shrine-audio:v1";
const BGM_VOLUME = 0.24;

function readSoundPreference() {
  try {
    return window.localStorage.getItem(AUDIO_PREFERENCE_KEY) !== "muted";
  } catch {
    return true;
  }
}

function saveSoundPreference(soundOn: boolean) {
  try {
    window.localStorage.setItem(AUDIO_PREFERENCE_KEY, soundOn ? "on" : "muted");
  } catch {
    // Private browsing or disabled storage should not break audio controls.
  }
}

export default function ShrineAudioToggle({
  src,
  shrineName,
}: {
  src: string;
  shrineName: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const soundOnRef = useRef(true);
  const [soundOn, setSoundOn] = useState(true);
  const [preferenceReady, setPreferenceReady] = useState(false);

  useEffect(() => {
    const savedSoundOn = readSoundPreference();
    soundOnRef.current = savedSoundOn;
    setSoundOn(savedSoundOn);
    setPreferenceReady(true);
  }, []);

  useEffect(() => {
    if (!preferenceReady) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = BGM_VOLUME;
    audio.currentTime = 0;

    const playIfEnabled = () => {
      if (!soundOnRef.current || document.hidden) return;
      void audio.play().catch(() => {
        // Browsers may wait for the first user gesture before allowing sound.
      });
    };

    if (soundOnRef.current) playIfEnabled();
    else audio.pause();

    const handleVisibilityChange = () => {
      if (document.hidden) audio.pause();
      else playIfEnabled();
    };

    window.addEventListener("pointerdown", playIfEnabled, { once: true });
    window.addEventListener("keydown", playIfEnabled, { once: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      audio.pause();
      window.removeEventListener("pointerdown", playIfEnabled);
      window.removeEventListener("keydown", playIfEnabled);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [preferenceReady, src]);

  const toggleSound = () => {
    const nextSoundOn = !soundOnRef.current;
    const audio = audioRef.current;

    soundOnRef.current = nextSoundOn;
    setSoundOn(nextSoundOn);
    saveSoundPreference(nextSoundOn);

    if (nextSoundOn) {
      void audio?.play().catch(() => {
        // The next pointer or keyboard interaction retries playback.
      });
    } else {
      audio?.pause();
    }
  };

  const label = `${shrineName} 배경음악 ${soundOn ? "끄기" : "켜기"}`;

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="auto" aria-hidden />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={label}
        aria-pressed={soundOn}
        title={label}
        style={{
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          padding: 0,
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.46)",
          color: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
        }}
      >
        {soundOn ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
            <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
            <path d="m17 9 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </>
  );
}

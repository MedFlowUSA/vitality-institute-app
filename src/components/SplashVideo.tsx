import { useEffect, useRef, useState } from "react";

type Props = {
  show: boolean;
  onFinish: () => void;
  src: string;
  maxMs?: number;
};

export default function SplashVideo({ show, onFinish, src, maxMs = 3200 }: Props) {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(show);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!show) return;

    setVisible(true);
    setFadeOut(false);

    const v = vidRef.current;

    // ✅ Force reload for reliable playback across SPA navigation
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
        v.load();
      } catch {}
    }

    const tryPlay = async () => {
      try {
        await v?.play(); // muted autoplay should work broadly
      } catch {
        // If blocked, safety timeout still dismisses
      }
    };

    tryPlay();

    const safety = window.setTimeout(() => {
      setFadeOut(true);
      window.setTimeout(() => {
        setVisible(false);
        onFinish();
      }, 350);
    }, maxMs);

    return () => window.clearTimeout(safety);
  }, [show, onFinish, maxMs, src]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "#F8F9FC" }}
      onClick={() => {
        // Optional: tap anywhere to skip
        setFadeOut(true);
        window.setTimeout(() => {
          setVisible(false);
          onFinish();
        }, 200);
      }}
    >
      <video
        key={src} // ✅ remount if src changes (dev cache-busting)
        ref={vidRef}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        onEnded={() => {
          setFadeOut(true);
          window.setTimeout(() => {
            setVisible(false);
            onFinish();
          }, 350);
        }}
        onError={() => {
          // ✅ never block the app if video fails
          setFadeOut(true);
          window.setTimeout(() => {
            setVisible(false);
            onFinish();
          }, 200);
        }}
        style={{
          width: "min(520px, 92vw)",
          height: "auto",
          borderRadius: "24px",
          boxShadow: "0 18px 55px rgba(17,24,39,0.15)",
          background: "transparent",
        }}
      />
    </div>
  );
}

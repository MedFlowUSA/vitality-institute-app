import { useEffect, useRef } from "react";

type Props = {
  show: boolean;
  onFinish: () => void;
  src: string;
  maxMs?: number;
};

export default function SplashVideo({ show, onFinish, src, maxMs = 3200 }: Props) {
  const vidRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!show) return;

    const v = vidRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
        v.load();
      } catch (e) {
        console.warn("Splash video reset failed.", e);
      }
    }

    const playTimer = window.setTimeout(() => {
      void vidRef.current?.play().catch((e) => {
        console.warn("Splash video autoplay blocked.", e);
      });
    }, 0);

    const safetyTimer = window.setTimeout(onFinish, maxMs);

    return () => {
      window.clearTimeout(playTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [show, onFinish, maxMs, src]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "#F8F9FC" }}
      onClick={onFinish}
    >
      <video
        key={src}
        ref={vidRef}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        onEnded={onFinish}
        onError={onFinish}
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

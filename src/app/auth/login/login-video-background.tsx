"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_SRC = process.env.NEXT_PUBLIC_LOGIN_VIDEO_URL ?? "/login-bg.mp4";

export function LoginVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const play = () => {
      video.play().catch(() => {});
    };
    const onCanPlay = () => {
      setVideoOk(true);
      play();
    };
    const onError = () => {
      setVideoOk(false);
    };
    if (video.readyState >= 2) {
      setVideoOk(true);
      play();
    } else {
      video.addEventListener("loadeddata", play);
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("error", onError);
    }
    return () => {
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: videoOk ? 1 : 0 }}
        aria-hidden
        onCanPlayThrough={() => videoRef.current?.play().catch(() => {})}
        onError={() => setVideoOk(false)}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/50" aria-hidden />
    </>
  );
}

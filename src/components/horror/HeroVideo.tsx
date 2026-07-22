"use client";

import { useEffect, useState } from "react";

const VERTICAL_SRC = "/video/video-cage-verticale.mp4";
const HORIZONTAL_SRC = "/video/video-cage-orizzontale.mp4";
const POSTER_VERTICAL = "/video/poster-verticale.jpg";
const POSTER_HORIZONTAL = "/video/poster-orizzontale.jpg";

const layerClassName =
  "absolute inset-0 h-full w-full object-cover transition-opacity duration-700";

export function HeroVideo() {
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");

    const sync = () => {
      const next = query.matches ? VERTICAL_SRC : HORIZONTAL_SRC;
      setReady(false);
      setSrc(next);
    };

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <>
      {/* Poster CSS-aware: visibile subito, senza scaricare il video inattivo. */}
      <img
        src={POSTER_HORIZONTAL}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className={`${layerClassName} portrait:hidden ${ready ? "opacity-0" : "opacity-100"}`}
      />
      <img
        src={POSTER_VERTICAL}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className={`${layerClassName} landscape:hidden ${ready ? "opacity-0" : "opacity-100"}`}
      />

      {src ? (
        <video
          key={src}
          aria-hidden="true"
          autoPlay
          className={`${layerClassName} ${ready ? "opacity-100" : "opacity-0"}`}
          loop
          muted
          playsInline
          preload="auto"
          src={src}
          onLoadedData={(event) => {
            const video = event.currentTarget;
            video.muted = true;
            void video
              .play()
              .catch(() => undefined)
              .finally(() => setReady(true));
          }}
        />
      ) : null}
    </>
  );
}

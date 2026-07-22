"use client";

import { useLayoutEffect, useRef } from "react";

const VERTICAL_SRC = "/video/video-cage-verticale.mp4";
const HORIZONTAL_SRC = "/video/video-cage-orizzontale.mp4";
const POSTER_SRC = "/rooms/il-manicomio.jpg";

const sharedClassName = "absolute inset-0 h-full w-full object-cover";

export function HeroVideo() {
  const verticalRef = useRef<HTMLVideoElement>(null);
  const horizontalRef = useRef<HTMLVideoElement>(null);

  useLayoutEffect(() => {
    const portraitQuery = window.matchMedia("(orientation: portrait)");

    const sync = () => {
      const isPortrait = portraitQuery.matches;
      const active = isPortrait ? verticalRef.current : horizontalRef.current;
      const idle = isPortrait ? horizontalRef.current : verticalRef.current;
      const activeSrc = isPortrait ? VERTICAL_SRC : HORIZONTAL_SRC;

      if (idle) {
        idle.pause();
        if (idle.getAttribute("src")) {
          idle.removeAttribute("src");
          idle.load();
        }
      }

      if (active) {
        if (active.getAttribute("src") !== activeSrc) {
          active.src = activeSrc;
        }
        active.muted = true;
        active.defaultMuted = true;
        void active.play().catch(() => {});
      }
    };

    sync();
    portraitQuery.addEventListener("change", sync);
    return () => portraitQuery.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <video
        ref={verticalRef}
        aria-hidden="true"
        autoPlay
        className={`${sharedClassName} landscape:hidden`}
        loop
        muted
        playsInline
        poster={POSTER_SRC}
        preload="auto"
        src={VERTICAL_SRC}
      />
      <video
        ref={horizontalRef}
        aria-hidden="true"
        autoPlay
        className={`${sharedClassName} portrait:hidden`}
        loop
        muted
        playsInline
        poster={POSTER_SRC}
        preload="auto"
        src={HORIZONTAL_SRC}
      />
    </>
  );
}

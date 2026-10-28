"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { asset } from "@/lib/asset";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });

/** WebGL support check that releases the probe context immediately. */
function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** 3D only where it is cheap and welcome: larger screens, capable devices, motion allowed. */
function shouldRender3D() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.matchMedia("(min-width: 48rem)").matches) return false;
  if (nav.connection?.saveData) return false;
  if ((nav.deviceMemory ?? 8) < 4 || (nav.hardwareConcurrency ?? 8) < 4) return false;
  return hasWebGL();
}

class GlobeErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function GlobeStage({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !shouldRender3D()) return;
    setEnabled(true);
    // Start loading the 3D chunk a little before the globe scrolls into view,
    // and only render frames while it is actually visible.
    const preload = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    const onScreen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "80px 0px" });
    preload.observe(el);
    onScreen.observe(el);
    return () => {
      preload.disconnect();
      onScreen.disconnect();
    };
  }, []);

  const fail = () => {
    setEnabled(false);
    setReady(false);
  };

  return (
    <div ref={ref} role="img" aria-label={label} className="relative mx-auto aspect-square w-full max-w-[36rem]">
      <picture>
        <source type="image/avif" srcSet={`${asset("/images/globe-fallback-640.avif")} 640w, ${asset("/images/globe-fallback-1000.avif")} 1000w`} sizes="(min-width: 1024px) 36rem, 90vw" />
        <img
          src={asset("/images/globe-fallback-1000.webp")}
          srcSet={`${asset("/images/globe-fallback-640.webp")} 640w, ${asset("/images/globe-fallback-1000.webp")} 1000w`}
          sizes="(min-width: 1024px) 36rem, 90vw"
          width={1000}
          height={1000}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full transition-opacity duration-[1.2s] ease-out ${ready ? "opacity-0" : "opacity-100"}`}
        />
      </picture>

      {enabled && near ? (
        <GlobeErrorBoundary onError={fail}>
          <div className={`absolute inset-0 transition-opacity duration-[1.2s] ease-out ${ready ? "opacity-100" : "opacity-0"}`}>
            <GlobeCanvas active={visible} onReady={() => setReady(true)} onContextLost={fail} />
          </div>
        </GlobeErrorBoundary>
      ) : null}
    </div>
  );
}

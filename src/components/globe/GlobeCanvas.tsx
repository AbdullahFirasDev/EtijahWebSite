"use client";

import { useEffect, useRef } from "react";
import { createGlobe, type GlobeHandle } from "./scene";

interface GlobeCanvasProps {
  active: boolean;
  onReady: () => void;
  onContextLost: () => void;
}

/** Mounts the Three.js globe into a div; loaded lazily by GlobeStage. */
export default function GlobeCanvas({ active, onReady, onContextLost }: GlobeCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GlobeHandle | null>(null);
  const callbacks = useRef({ onReady, onContextLost });
  const activeRef = useRef(active);

  useEffect(() => {
    callbacks.current = { onReady, onContextLost };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    try {
      const handle = createGlobe(host, {
        onReady: () => callbacks.current.onReady(),
        onContextLost: () => callbacks.current.onContextLost(),
      });
      handleRef.current = handle;
      handle.setActive(activeRef.current);
      return () => {
        handle.dispose();
        handleRef.current = null;
      };
    } catch {
      // WebGL context creation can still fail after feature detection (blocklisted GPU, etc.).
      callbacks.current.onContextLost();
    }
  }, []);

  useEffect(() => {
    activeRef.current = active;
    handleRef.current?.setActive(active);
  }, [active]);

  return <div ref={hostRef} className="absolute inset-0" />;
}

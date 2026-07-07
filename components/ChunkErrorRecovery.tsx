"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "chunk-error-reload";

export default function ChunkErrorRecovery() {
  useEffect(() => {
    const isChunkError = (message: unknown) =>
      typeof message === "string" &&
      (message.includes("ChunkLoadError") || message.includes("Loading chunk"));

    const reloadOnce = () => {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkError(event.message) || isChunkError(event.error?.name)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkError(event.reason?.name) || isChunkError(event.reason?.message)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    // Page loaded fine post-reload — clear the flag so a later, unrelated
    // chunk error can still trigger a recovery reload.
    const clearFlag = setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 3000);
    return () => {
      clearTimeout(clearFlag);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

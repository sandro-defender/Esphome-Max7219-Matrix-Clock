import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { detectTimezone, withDetectedTimezone } from "./timezone";
import type { Config } from "./types";

export const TIMEZONE_RECHECK_MS = 60_000;

/** Browsers have no timezonechange event; recheck when returning and while open. */
export function useAutomaticTimezone(setConfig: Dispatch<SetStateAction<Config>>): string | null {
  const [detected, setDetected] = useState(detectTimezone);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      const zone = detectTimezone();
      setDetected(zone);
      // Functional update reads the latest manual/automatic choice, not a
      // stale closure from the time the listener was first installed.
      setConfig((current) => withDetectedTimezone(current, zone));
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, TIMEZONE_RECHECK_MS);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [setConfig]);
  return detected;
}

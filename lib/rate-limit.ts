import type { NextRequest } from "next/server";

// Basic in-memory sliding-window rate limiter for the AI endpoints, keyed by
// client IP. Suited to this app's single-process `next start` deployment:
// no external store, survives for the life of the process. Limits reset on
// restart and are per-instance — if we ever scale to multiple instances or
// serverless, swap the Map for a shared store (e.g. Redis/Upstash) behind the
// same check() interface.

type WindowEntry = { timestamps: number[] };

const buckets = new Map<string, Map<string, WindowEntry>>();

// Periodically drop stale entries so the map doesn't grow unbounded from
// one-off visitors. Runs lazily during checks rather than on a timer.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(
  bucket: string,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  let entries = buckets.get(bucket);
  if (!entries) {
    entries = new Map();
    buckets.set(bucket, entries);
  }

  if (now - lastSweep > SWEEP_INTERVAL_MS) {
    lastSweep = now;
    for (const map of buckets.values()) {
      for (const [k, entry] of map) {
        if (entry.timestamps.every((t) => now - t > windowMs)) map.delete(k);
      }
    }
  }

  let entry = entries.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    entries.set(key, entry);
  }

  // Slide the window: keep only timestamps still inside it.
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  return { ok: true };
}

// Best-effort client IP. Behind a reverse proxy / CDN the real client is the
// first hop in x-forwarded-for; direct connections fall back to a fixed key
// (still limits total throughput rather than failing open per-request).
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

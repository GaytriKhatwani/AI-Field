"use client";

import mixpanel from "mixpanel-browser";
import {
  EVENTS,
  ALLOWED_PROPERTY_KEYS,
  PROHIBITED_KEY_PATTERNS,
  type EventName,
  type EventProps,
} from "./events";

// The single tracking boundary. Client-side only, identified-only, safe no-op
// when unconfigured. See ANALYTICS.md for the locked contract.
//
// States:
//   no token, prod  → full no-op.
//   no token, dev   → validate + console-log intent (status "no-token"), no network.
//   token present   → validate + console-log (dev) + mixpanel.track.

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const API_HOST = process.env.NEXT_PUBLIC_MIXPANEL_API_HOST;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const isDev = process.env.NODE_ENV !== "production";

const EVAL_DEDUP_PREFIX = "aifield.mp.evalTracked.";

let initialized = false; // SDK actually booted (token present)
let identified = false; // identify() called → events permitted
let currentUserId: string | null = null;

/** Boot the SDK once (client). No token → stays a no-op (dev still logs intent). */
export function initAnalytics(): void {
  if (initialized || typeof window === "undefined" || !TOKEN) return;
  mixpanel.init(TOKEN, {
    autocapture: false,
    track_pageview: false,
    record_sessions_percent: 0,
    ip: false, // no IP/geolocation collection
    // Controlled MVP cohort: measure the funnel even for Do-Not-Track browsers
    // (analytics is anonymous + metadata-only). Revisit with the consent work
    // before broader/public exposure — see ANALYTICS.md launch checklist.
    ignore_dnt: true,
    persistence: "localStorage",
    ...(API_HOST ? { api_host: API_HOST } : {}),
    debug: isDev,
  });
  mixpanel.register({ app_version: APP_VERSION, platform: "web" });
  initialized = true;
}

/** Bind the analytics identity to the Supabase anonymous user id. */
export function identifyUser(userId: string): void {
  if (!userId) return;
  if (initialized) mixpanel.identify(userId);
  identified = true;
  currentUserId = userId;
}

/** Discard identity + dedup state so a new anonymous user starts clean. */
export function resetAnalytics(): void {
  clearEvalDedup();
  if (initialized) mixpanel.reset();
  identified = false;
  currentUserId = null;
}

/**
 * The only way to emit a product event. Closed + typed: `event` must be a catalog
 * name and `props` must match its contract. Enforces the identity gate, the dev
 * allowlist guard, and the Evaluation Completed double-fire guard.
 */
export function track<E extends EventName>(event: E, props: EventProps[E]): void {
  const p = props as Record<string, unknown>;

  // 1) Identity gate — no userId, no event (no queue, no pre-identify merge).
  if (!identified) {
    if (isDev) console.warn(`[analytics] BLOCKED "${event}" — no identified user yet`);
    return;
  }

  // 2) Dev allowlist / prohibited-content guard (mechanical, at the boundary).
  if (isDev) validateProps(event, p);

  // 3) Evaluation Completed double-fire guard (local flag + Mixpanel $insert_id).
  let insertId: string | undefined;
  if (event === EVENTS.EVALUATION_COMPLETED) {
    const attemptId = String(p.attempt_id ?? "");
    if (attemptId && evalAlreadyTracked(attemptId)) {
      if (isDev) logEvent(event, p, "deduped");
      return;
    }
    if (attemptId) markEvalTracked(attemptId);
    insertId = `eval:${attemptId}`;
  }

  // 4) Emit — or, with no token, log intent in dev and stop (safe no-op).
  if (isDev) logEvent(event, p, initialized ? "sent" : "no-token");
  if (!initialized) return;
  mixpanel.track(event, insertId ? { ...p, $insert_id: insertId } : p);
}

// -- dev guard --------------------------------------------------------------

function validateProps(event: string, p: Record<string, unknown>): void {
  for (const key of Object.keys(p)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) {
      console.error(`[analytics] "${event}" — property "${key}" is NOT in the allowlist`);
    }
    if (PROHIBITED_KEY_PATTERNS.some((re) => re.test(key))) {
      console.error(`[analytics] "${event}" — property "${key}" looks like prohibited content`);
    }
  }
}

function logEvent(event: string, p: Record<string, unknown>, status: string): void {
  // Props are already allowlist-constrained, so this never prints prohibited
  // content. Inlined as text (not a console object) so the full event is legible
  // in log readers during the correctness pass.
  console.info(
    `[analytics] ${status.toUpperCase()} · ${event} · user=${currentUserId} · ${JSON.stringify(p)}`,
  );
}

// -- Evaluation Completed dedup (localStorage) ------------------------------

function evalAlreadyTracked(attemptId: string): boolean {
  try {
    return localStorage.getItem(EVAL_DEDUP_PREFIX + attemptId) === "1";
  } catch {
    return false;
  }
}

function markEvalTracked(attemptId: string): void {
  try {
    localStorage.setItem(EVAL_DEDUP_PREFIX + attemptId, "1");
  } catch {
    /* storage unavailable — the $insert_id is the backstop */
  }
}

function clearEvalDedup(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("aifield.mp.")) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export { EVENTS };

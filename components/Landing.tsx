"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousUser } from "@/lib/supabase/bootstrap";
import { createClient } from "@/lib/supabase/client";
import { initAnalytics, identifyUser, track, EVENTS } from "@/lib/analytics/client";
import { ACCOUNT_LINKING_ENABLED } from "@/lib/flags";
import { Arrow } from "@/components/icons";

// The public landing (Persuade). Rendered outside FieldProvider, so it holds no
// store and mints no anonymous user on view. "Try your first mission" is the
// only thing that creates the anon identity: mint → identify → Get Started
// Clicked → the existing 3-question FTUE. Copy is the v2 finalized version — the
// payoff shown is the evidence-backed read, not a profile dashboard.
export function Landing() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);

  // Boot analytics here too — this route never mounts <Providers>, so the Start
  // event needs the SDK initialised (safe no-op / dev-log when unconfigured).
  useEffect(() => {
    initAnalytics();
  }, []);

  async function start() {
    if (starting) return;
    setError(false);
    setStarting(true);
    try {
      const { user } = await ensureAnonymousUser();
      if (user) {
        identifyUser(user.id);
        track(EVENTS.GET_STARTED_CLICKED, {});
      }
      router.push("/onboarding");
    } catch {
      setError(true);
      setStarting(false);
    }
  }

  async function signIn() {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/field` },
      });
    } catch {
      setError(true);
    }
  }

  return (
    <main className="mx-auto max-w-reading px-[clamp(1.25rem,5vw,3.25rem)] pb-24 pt-[clamp(1.5rem,4vw,2.5rem)]">
      <header className="flex items-baseline justify-between">
        <span
          className="font-semibold uppercase text-ink"
          style={{ fontSize: "0.82rem", letterSpacing: "0.2em" }}
        >
          AI&nbsp;Field
        </span>
        {ACCOUNT_LINKING_ENABLED && (
          <button type="button" onClick={signIn} className="btn--quiet">
            Sign in
          </button>
        )}
      </header>

      {/* HERO — passes the 5-second test: what is this / what will I do / why care */}
      <section className="mt-[clamp(3rem,10vw,6.5rem)] animate-riseIn" aria-label="What AI Field is">
        <h1 className="display text-ink" style={{ fontSize: "clamp(2.7rem,8vw,5rem)", maxWidth: "15ch" }}>
          Get better at using AI for real work.
        </h1>
        <p className="mt-[1.6rem] max-w-[42ch] text-[clamp(1.1rem,2.6vw,1.35rem)] font-medium leading-[1.4] text-ink">
          Take on a realistic work assignment, tackle it with a real AI, and get
          an honest, specific read on how you did — and what to get sharper at next.
        </p>
        <div className="mt-[2.2rem] flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" onClick={start} disabled={starting} className="btn">
            {starting ? "Starting…" : "Try your first mission"}
            {!starting && <Arrow className="arr" />}
          </button>
          <span className="meta">No signup · about 10 minutes</span>
        </div>
        {error && (
          <p role="alert" className="mt-4 max-w-measure text-[0.9rem] text-warn">
            Couldn&rsquo;t start just now — check your connection and try again.
          </p>
        )}
      </section>

      <hr className="rule my-[clamp(2.75rem,7vw,4.5rem)]" />

      {/* WHAT YOU'LL DO — concrete workplace assignment; the anti-course line */}
      <section aria-label="What you'll do" className="max-w-measure">
        <h2 className="section-label mb-4">What you&rsquo;ll do</h2>
        <p className="text-[1.05rem] leading-relaxed text-ink">
          You get a real piece of work — a messy meeting to sort out, a shaky
          report, a brief that&rsquo;s missing half the details. You handle it with
          a real AI: tell it what you need, push back on what it gives you, and
          decide what&rsquo;s good enough to send.{" "}
          <span className="font-semibold">
            This isn&rsquo;t a course — no lessons, no prompt lists. You do the work.
          </span>
        </p>
      </section>

      <hr className="rule my-[clamp(2.75rem,7vw,4.5rem)]" />

      {/* WHAT YOU GET — the payoff is the evidence-backed read, not a dashboard */}
      <section aria-label="What you get">
        <h2 className="section-label mb-4">What you get</h2>
        <p className="max-w-measure text-[1.05rem] leading-relaxed text-ink">
          Then you get an honest read on how you worked — specific, and backed by
          what you actually did. Not a score. The kind of feedback a sharp
          colleague would give you:
        </p>

        <ExampleRead />
      </section>

      <hr className="rule my-[clamp(2.75rem,7vw,4.5rem)]" />

      {/* CLOSING — a real, anchored close */}
      <section aria-label="Start" className="max-w-measure">
        <h2 className="display text-ink" style={{ fontSize: "clamp(1.9rem,5.5vw,3rem)" }}>
          See how you actually work with AI.
        </h2>
        <div className="mt-[1.8rem] flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" onClick={start} disabled={starting} className="btn">
            {starting ? "Starting…" : "Try your first mission"}
            {!starting && <Arrow className="arr" />}
          </button>
          <span className="meta">No signup · about 10 minutes</span>
        </div>
      </section>
    </main>
  );
}

// A static, illustrative example of the debrief read — the landing's strongest
// visual. It mirrors the real debrief's section labels and evidence-anchored
// tone (NOT a profile dashboard); the cumulative capability record is a single
// quiet line beneath it. Plainly labelled "example" so it's never mistaken for
// the visitor's own data.
function ExampleRead() {
  return (
    <div className="mt-7 max-w-measure animate-fadeUp rounded-sm border border-hairline bg-raised px-[clamp(1.1rem,3vw,1.75rem)] py-[clamp(1.3rem,3vw,1.75rem)]">
      <p className="meta mb-6 flex items-baseline justify-between gap-4">
        <span>Your read</span>
        <span className="text-ink-3" style={{ letterSpacing: "0.14em" }}>
          example
        </span>
      </p>

      <dl className="m-0 space-y-5">
        <div>
          <dt className="section-label mb-1.5" style={{ color: "var(--accent)" }}>
            What worked
          </dt>
          <dd className="m-0 text-[0.98rem] leading-relaxed text-ink">
            You gave the AI the meeting notes up front, so it worked from real
            details instead of guessing.
          </dd>
        </div>
        <div>
          <dt className="section-label mb-1.5" style={{ color: "var(--warn)" }}>
            What you missed
          </dt>
          <dd className="m-0 text-[0.98rem] leading-relaxed text-ink">
            You used the AI&rsquo;s first summary as final — it had invented two
            action items no one agreed to.
          </dd>
        </div>
        <div>
          <dt className="section-label mb-1.5">What to practice next</dt>
          <dd className="m-0 text-[0.98rem] leading-relaxed text-ink">
            Checking the AI&rsquo;s work before you rely on it.
          </dd>
        </div>
      </dl>

      <hr className="rule my-5" />
      <p className="m-0 text-[0.88rem] leading-relaxed text-ink-3">
        Every assignment quietly builds a record of how you&rsquo;re growing —
        across the five habits of strong AI work.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousUser } from "@/lib/supabase/bootstrap";
import { createClient } from "@/lib/supabase/client";
import { initAnalytics, identifyUser, track, EVENTS } from "@/lib/analytics/client";
import { ACCOUNT_LINKING_ENABLED } from "@/lib/flags";
import { Arrow } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

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

  const cta = (
    <div className="mt-[2.4rem] flex flex-wrap items-center gap-x-6 gap-y-3">
      <button type="button" onClick={start} disabled={starting} className="btn">
        {starting ? "Starting…" : "Try your first scenario"}
        {!starting && <Arrow className="arr" />}
      </button>
      <span className="meta">No signup · about 10 minutes</span>
    </div>
  );

  return (
    <main className="pb-16">
      {/* HERO — a wide, asymmetric band: value on the left, a cropped fragment of
          the real product (assignment → AI work → the read) on the right. The
          band clips its own bleed so the page never scrolls sideways. */}
      <section
        aria-label="What AI Field is"
        className="overflow-hidden border-b border-hairline"
      >
        <div className="mx-auto max-w-[92rem] px-[clamp(1.25rem,5vw,4rem)] pt-[clamp(1.5rem,4vw,2.5rem)]">
          <header className="flex items-baseline justify-between">
            <span
              className="font-semibold uppercase text-ink"
              style={{ fontSize: "0.82rem", letterSpacing: "0.2em" }}
            >
              AI&nbsp;Field
            </span>
            <div className="flex items-center gap-4">
              {ACCOUNT_LINKING_ENABLED && (
                <button type="button" onClick={signIn} className="btn--quiet">
                  Sign in
                </button>
              )}
              <ThemeToggle />
            </div>
          </header>

          <div className="grid items-center gap-x-[clamp(2rem,5vw,5rem)] gap-y-[clamp(3rem,7vw,4.5rem)] pb-[clamp(3rem,7vw,6rem)] pt-[clamp(2.5rem,7vw,5.5rem)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            {/* Left — the pitch */}
            <div className="max-w-[32rem] animate-riseIn">
              <h1
                className="display text-ink"
                style={{ fontSize: "clamp(2.6rem,6vw,4.4rem)", maxWidth: "13ch" }}
              >
                Get better at doing real work with AI.
              </h1>
              <p className="mt-[1.7rem] max-w-[40ch] text-[clamp(1.05rem,1.5vw,1.3rem)] font-medium leading-[1.45] text-ink">
                Practise realistic workplace scenarios, see how you approach them,
                and learn what to improve next.
              </p>
              {cta}
              {error && (
                <p role="alert" className="mt-4 max-w-measure text-[0.9rem] text-warn">
                  Couldn&rsquo;t start just now — check your connection and try again.
                </p>
              )}
            </div>

            {/* Right — the product, cropped and composed */}
            <ProductScene />
          </div>
        </div>
      </section>

      {/* Below the hero: one compact section — the value on the left, the five-step
          practice sequence on the right — then a single CTA row under a hairline.
          Deliberately dense (spacing well below the hero's) so the whole page reads
          in ~1.5 screens. No cards, icons, or a second review example. */}
      <div className="mx-auto max-w-reading px-[clamp(1.25rem,5vw,3.25rem)] pt-[clamp(1.75rem,4vw,2.75rem)]">
        <section
          aria-label="How it works"
          className="grid gap-x-[clamp(2rem,6vw,4.5rem)] gap-y-[clamp(1.5rem,4vw,2.25rem)] md:grid-cols-2 md:items-center"
        >
          <div className="max-w-[26ch]">
            <h2
              className="heading text-ink"
              style={{ fontSize: "clamp(1.5rem,3.6vw,2.05rem)", lineHeight: 1.12 }}
            >
              Good AI work is more than writing a prompt.
            </h2>
            <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-2">
              Practise a realistic work situation from start to finish, not just the
              prompt.
            </p>
          </div>
          <StepFlow />
        </section>

        <hr className="rule my-[clamp(1.75rem,4.5vw,2.75rem)]" />

        {/* one horizontal CTA row: the close on the left, the action on the right */}
        <section
          aria-label="Start"
          className="flex flex-col gap-x-[clamp(2rem,6vw,4rem)] gap-y-6 md:flex-row md:items-center md:justify-between"
        >
          <h2
            className="display max-w-[15ch] text-ink"
            style={{ fontSize: "clamp(1.7rem,4.5vw,2.5rem)", lineHeight: 1.04 }}
          >
            See how you actually work with AI.
          </h2>
          <div className="flex-none">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <button type="button" onClick={start} disabled={starting} className="btn">
                {starting ? "Starting…" : "Try your first scenario"}
                {!starting && <Arrow className="arr" />}
              </button>
              <span className="meta">No signup · about 10 minutes</span>
            </div>
            {error && (
              <p role="alert" className="mt-3 max-w-measure text-[0.9rem] text-warn">
                Couldn&rsquo;t start just now — check your connection and try again.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// The hero's right half: one composed, cropped view of the real loop — the messy
// assignment, a sliver of directing the AI, and the evidence-backed read as the
// sharp payoff in front. Not three cards: the notes and the exchange are raw,
// bleeding fragments; only the read is a framed surface, lifted and in focus.
// The story reveals in sequence (notes → direction → read) via staggered rise.
function ProductScene() {
  return (
    <div className="relative w-full" aria-hidden>
      {/* 1 — the assignment: real raw notes, dim, cropped by a bottom fade */}
      <figure className="relative z-10 animate-fadeUp" style={{ animationDelay: "80ms" }}>
        <figcaption className="meta mb-2 flex items-center gap-2 text-ink-3">
          <span aria-hidden className="inline-block h-px w-5 bg-hairline" />
          Raw meeting notes
        </figcaption>
        <pre
          className="max-h-[8rem] overflow-hidden whitespace-pre-wrap font-mono text-[0.68rem] leading-[1.55] text-ink-3"
          style={{
            maskImage: "linear-gradient(to bottom, #000 44%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 44%, transparent)",
          }}
        >
{`PLANNING CALL — Q3 launch (45 min, half of it went sideways)
present: Priya (PM), Marcus (eng), Dana (design), Sam (marketing), + Leo joined late

- kicked off talking about the launch date. Priya wants Sept 15. Marcus pushed
  back, said the API work isn't done, maybe 2 more weeks. left it as "target
  15th, revisit Fri"
- big debate about whether to ship the referral feature in v1. Marcus thinks
  it's risky. Priya said cut it if it threatens the date. Nobody actually
  decided?? felt decided but reading back my notes it wasn't`}
        </pre>
      </figure>

      {/* 2 — directing the AI: a hint of the workbench, hairline-tethered */}
      <div
        className="relative z-20 mt-6 ml-8 hidden animate-fadeUp sm:ml-14 md:block"
        style={{ animationDelay: "220ms" }}
      >
        <p className="meta mb-2.5 flex items-center gap-2 text-ink-3">
          <span aria-hidden className="inline-block h-px w-5 bg-hairline" />
          You work with the AI
        </p>
        <div className="space-y-2 border-l border-hairline pl-4">
          <p className="text-[0.86rem] leading-snug text-ink">
            <span className="meta mr-2 align-middle text-accent">You</span>
            Use only these notes. Pull the real decisions, owners, and due dates —
            and flag anything the notes don&rsquo;t actually say.
          </p>
          <p className="text-[0.86rem] leading-snug text-ink-2">
            <span className="meta mr-2 align-middle">AI</span>
            Summary from the notes only. Launch date: &ldquo;target Sept 15&rdquo;,
            not committed…
          </p>
        </div>
      </div>

      {/* 3 — the read: the payoff, forward and in focus */}
      <div
        className="relative z-30 mt-7 max-w-[29rem] animate-riseIn rounded-sm border border-hairline bg-raised px-[clamp(1.15rem,2.2vw,1.75rem)] py-[clamp(1.25rem,2.2vw,1.6rem)] shadow-layer md:ml-16 lg:ml-28"
        style={{ animationDelay: "360ms" }}
      >
        <p className="meta mb-5 flex items-baseline justify-between gap-4">
          <span>Your review</span>
          <span className="text-ink-3" style={{ letterSpacing: "0.14em" }}>
            example
          </span>
        </p>
        <dl className="m-0 space-y-4">
          <div>
            <dt className="section-label mb-1.5" style={{ color: "var(--accent)" }}>
              What worked
            </dt>
            <dd className="m-0 text-[0.96rem] leading-relaxed text-ink">
              You gave the AI the raw notes and told it to use only what they
              support — so it worked from real details, not guesses.
            </dd>
          </div>
          <div>
            <dt className="section-label mb-1.5" style={{ color: "var(--warn)" }}>
              What to improve next
            </dt>
            <dd className="m-0 text-[0.96rem] leading-relaxed text-ink">
              You let a due date the notes never gave slip through — an invented
              commitment made it into the summary.
            </dd>
          </div>
          <div>
            <dt className="section-label mb-1.5">What to practise next</dt>
            <dd className="m-0 text-[0.96rem] leading-relaxed text-ink">
              Checking the AI&rsquo;s work before you rely on it.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// The five-step loop as a compact vertical sequence — the proof beside the "more
// than a prompt" hook. A semantic <ol> (a screen reader reads it as an ordered
// list) drawn as a connected rail of nodes, the same timeline idiom the debrief
// uses. It reads the same in the hero's right column and stacked on mobile.
const STEPS = [
  "Get a brief",
  "Choose materials",
  "Work with AI",
  "Build your deliverable",
  "Get your review",
];

function StepFlow() {
  return (
    <ol aria-label="How a scenario works, step by step" className="relative m-0 list-none p-0">
      {STEPS.map((step, i) => (
        <li key={step} className="relative flex items-baseline gap-3.5 pb-3.5 last:pb-0">
          {i < STEPS.length - 1 && (
            <span aria-hidden className="absolute left-[3px] top-[0.9em] h-full w-px bg-hairline" />
          )}
          <span
            aria-hidden
            className="relative z-10 mt-[0.45em] h-[7px] w-[7px] flex-none rounded-full bg-ink-3"
          />
          <span className="text-[0.98rem] font-medium leading-snug text-ink">{step}</span>
        </li>
      ))}
    </ol>
  );
}

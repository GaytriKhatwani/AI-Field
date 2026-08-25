# AI Field — The Obvious Solution to Avoid

> Companion to `EXPERIENCE-THESIS.md`. This names the predictable interface a generic agent would generate from `plan.md`/`SPEC.md` given the brief *"create a modern, premium interface for this product"* — the category default (the "rut") we deliberately keep out of the design candidate set. It is an **anti-reference**, not a direction. Do not build toward any of this.

---

## The interface it would most likely generate

A **shadcn/ui + Tailwind dashboard** in the current default-premium house style: a neutral slate/zinc palette with one indigo-or-violet accent, `rounded-2xl` white cards with soft drop shadows floating on a near-white (or subtly gradient-mesh) ground, Inter/Geist type, generous-but-uniform padding, and a faint purple→blue "AI gradient" plus a ✨ sparkle somewhere to signal "this is an AI product." Every surface would be a centered column or a sidebar-plus-content shell, composed from the same handful of card, badge, and progress-bar primitives. It would look competent, expensive, and completely indistinguishable from every other YC-era SaaS app — which is precisely the failure. It would read as an **LMS + analytics dashboard + ChatGPT wrapper**, i.e. the exact three things `PRODUCT.md` says AI Field must not feel like.

## Predictable conventions, surface by surface

**Onboarding** — A centered modal/card on a blurred gradient background, with a **"Step 1 of 3" progress bar or numbered stepper** at the top. Role shown as a grid of selectable radio-cards or pills; a big gradient "Get started" button; probably the classic split-screen with a decorative illustration panel on the left (even though there's no auth to justify it). Copy like *"Let's personalize your experience."* Feels like enrolling in a setup wizard.

**The Field** — Where it goes most wrong: it becomes a **dashboard home**. A **left sidebar** (Home / Missions / Progress / Settings) and a top bar with search + avatar; a *"Welcome back"* header; a **row of KPI stat tiles** (missions completed, 🔥 streak, avg score); a **grid of identical mission cards** (icon-in-a-tinted-circle, title, tag-pill row, difficulty badge, progress ring, ghost "Start" button); and the five competencies rendered as a **radar/spider chart** or five percentage progress bars inside a card titled "Your Skills." An LMS course dashboard with analytics — the primary anti-reference.

**Briefing** — A centered content card with title + muted subtitle, then **three identical white sub-cards** ("Scenario / Objective / Constraints"), each with a little icon; constraints as a check-icon bullet list; a **metadata pill row** (~10 min · Easy · Context · Direction · Synthesis); a gradient "Start Mission" button bottom-right. Symmetric, templated, weightless.

**Workbench** — A two-pane split where the left pane is a **near-exact ChatGPT clone**: message bubbles, avatar circles, "regenerate" buttons, a rounded input with a send arrow and a ✨. Resources as a card list with attach toggles/chips; the deliverable as a form-in-a-card on the right with rounded inputs and "Add row" buttons; a top bar with the objective and a gradient "Submit." The turn count shown as a **"4 / 8 messages" meter** — which the spec explicitly forbids from influencing score, yet the default visualizes as a progress bar anyway. Reads as "a chatbot with a form next to it."

**Debrief** — A **big score reveal**: a circular gauge with "85 / 100" or *"Great job! 🎉,"* possibly confetti; competency deltas as bar charts with green ▲ badges and "+12%" pills; a **before/after radar overlay**; coaching in colored-left-border cards ("What worked ✓ / To improve △"); a "Next mission" gradient CTA; a share button and "badges earned." A gamified grade screen — the exact opposite of an earned, honest debrief.

---

## AI Field Anti-Pattern Checklist

Ten patterns to actively challenge during design. Each one, if it shows up, is a signal we defaulted instead of designed. Format: **the pattern → why it's wrong for AI Field → the challenge.**

1. **The Field as a dashboard.** Sidebar nav + KPI stat tiles + mission-card grid + a "Your Skills" chart card. → It's an LMS/analytics home, our #1 anti-reference; it says "browse content," not "step into work." → *Challenge:* if a surface reads as an admin or analytics dashboard, redesign it as an entry into work.

2. **Competencies as generic data-viz.** A radar/spider chart, or five uniform progress bars with % numbers. → Bands are the point (`not shown → strong`); numbers and chart widgets make it fake-precise and vanity-metric. → *Challenge:* no numbers, no chart primitive — find a representation of *demonstrated capability* that isn't a stat visualization.

3. **The score reveal.** A big number/gauge, "85/100," celebration, confetti, "+%" deltas. → There is no headline score; the debrief is coaching, and gamified reveals violate "honesty over praise." → *Challenge:* the debrief leads with an honest read of *how you worked*, never a grade.

4. **Identical white rounded cards for everything.** Every piece of content in the same `rounded-2xl` white container with a soft shadow. → Container-per-thing is the default reflex; it flattens five differently-jobbed surfaces into one texture. → *Challenge:* justify every card; earn each surface's structure from its actual job, not a shared shell.

5. **The workbench as a ChatGPT clone.** Bubble chat + avatars + ✨ input + regenerate buttons, with a form bolted beside it. → It's a *workbench for directing an instrument*, not a messaging app; the chat metaphor pulls users into "chatting," which is the weak behavior we measure against. → *Challenge:* design directing and building, not conversing; reject the messenger metaphor.

6. **Pill / badge inflation.** Tag rows, difficulty badges, competency chips, skill tags on every card. → Most pills encode metadata that doesn't need a chip; they're premium-SaaS decoration. → *Challenge:* challenge every pill; keep one only if it changes a decision the user is making.

7. **Progress widgets and meters.** Progress rings, streak flames, "4/8 messages" meters, XP-style bars. → Streaks and turn-meters are exactly the gamification `PRODUCT.md` bans; the turn cue is a soft nudge, not a score. → *Challenge:* no streaks, no XP, no meter that drives behavior; progress is discovered through evidence, not metered.

8. **Decorative AI gradients and sparkle motifs.** Purple→blue mesh backgrounds, gradient CTAs, ✨ "AI" iconography. → Decoration that signals "AI product" instead of doing work; the generic tell of the whole category. → *Challenge:* every visual element earns its place by doing a job; nothing exists to say "this is AI."

9. **Stepper / wizard onboarding on a hero-gradient card.** "Step 1 of 3," centered modal, split illustration panel, "personalize your experience." → Onboarding should feel like being *let in and trusted*, not enrolling in a configuration flow. → *Challenge:* design arrival as being handed the keys, not a three-step form.

10. **Symmetric, template-repeated sections.** Every screen = centered column, "Title + muted subtitle," three equal cards, primary button bottom-right — the same shadcn composition reused surface to surface. → Five surfaces with five different jobs rendered as one template is the definition of "generic premium SaaS." → *Challenge:* each surface gets a composition derived from its job; reject the repeated section template.

---

**Coverage note:** these ten fold in every tell to watch for — dashboard composition (1), card grids (1, 4), identical white containers (4), sidebar nav (1), excessive pills (6), progress widgets (7), generic stat viz (2), symmetric layouts (10), repeated templates (10), standard shadcn compositions (4, 5, 10), unnecessary rounded rectangles (4), decorative AI gradients (8), and generic premium-SaaS styling (throughout, esp. 8).

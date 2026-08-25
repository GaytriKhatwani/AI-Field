# AI Field — Design System

> The small, practical system that keeps the MVP coherent. Not a component encyclopedia. It locks the decisions the six surfaces share, derived from the built reference `the-field.html` and governed by `DESIGN-CHARTER.md` (Standing Assignment) and `ANTI-PATTERNS.md`. Source of visual truth is the running app + this file; when they disagree, fix the app to match here or update here deliberately.

Direction in one line: **a warm mineral-stone workroom where one real assignment is held in focus** — drafting-precise hairlines, sharp geometry, one petrol accent, typography (not cards) doing the hierarchy.

---

## Typography

Two families, self-hosted via `next/font` (Google): **Bricolage Grotesque** (display) and **Public Sans** (body). Bricolage does the hierarchy work so surfaces don't need cards.

| Role | Family / weight | Size | Tracking / leading |
|---|---|---|---|
| **Display XL** — the one assignment | Bricolage 700 | `clamp(2.7rem, 8.5vw, 5rem)` | `-0.03em` / `0.98` |
| **Display L** — screen / mission name | Bricolage 700 | `clamp(2rem, 5vw, 3rem)` | `-0.025em` / `1.0` |
| **Heading M** — mission row, deliverable section | Bricolage 600 | `1.2rem` | `-0.01em` / `1.2` |
| **Lead** — recommendation reason, scenario open | Public Sans 500 | `clamp(1.05rem, 2.4vw, 1.2rem)` | `1.45` |
| **Body** — reading copy | Public Sans 400 | `1rem–1.12rem` | `1.5`, measure 62–72ch |
| **Section label** — quiet region headers | Public Sans 600 | `0.72rem` UPPER | `0.16em` |
| **Meta** — effort · capabilities | Public Sans 600 | `0.76rem` UPPER | `0.11em`, color `--ink-3` |
| **State / micro** — capability phrases, hints | Public Sans 400/500 | `0.82rem` | `1.35`, color `--ink-3` |

Rules: display uses Bricolage only; never set body in Bricolage. Numerals in data (effort, due dates, counts) use `font-variant-numeric: tabular-nums`. Never use monospace as a "technical" costume. Balance headings (`text-wrap: balance`), cap display measure at ~40ch.

---

## Color — semantic roles only

Full light + dark. Roles map to CSS variables (see `app/globals.css`); components reference roles, never raw hex. No purple/blue "AI" gradients, ever.

| Role | Token | Light | Dark |
|---|---|---|---|
| Page background | `--ground` | `#E7E6DF` | `#161715` |
| Raised / grouped surface | `--raised` | `#F1EFE9` | `#1E201C` |
| Primary text | `--ink` | `#1B1C18` | `#E9E7DE` |
| Secondary text | `--ink-2` | `#54554C` | `#A6A59B` |
| Subtle text | `--ink-3` | `#63635A` | `#8B8B80` |
| Primary accent (petrol) | `--accent` | `#0E5C6A` | `#59BBC8` |
| Accent strong (hover/press) | `--accent-strong` | `#0A4A56` | `#7BCDD6` |
| On accent | `--on-accent` | `#F1EFE9` | `#0A2429` |
| Interactive (links, inline) | `--accent` | — | — |
| Success (context given, band ↑) | `--good` | `#3F6E52` | `#7FB79A` |
| Caution (privacy, turn ceiling) | `--warn` | `#8A6631` | `#C6A15E` |
| Unavailable / not-yet-relevant | `--ink-3` (+ text tag) | — | — |
| Borders / rules (hairline) | `--hairline` | `#D0CDC3` | `#2C2E29` |
| Focus / selected | `--accent` (outline) · `--raised` (fill) | — | — |
| Open marker (capability) | `--marker-open` | `#7C7B70` | `#77776D` |
| Text selection | `--sel-bg` | `rgba(14,92,106,.17)` | `rgba(89,187,200,.22)` |

Petrol is the **only** hue used to attract action. `--good` / `--warn` are low-chroma earth tones reserved strictly for genuine state (a given resource, a moved band, the privacy/ceiling warning) — never decoration, never a whole colored surface. Theme choice defaults to system; a `data-theme` attribute wins when set. Secondary text on a colored surface tints from that hue, never flat gray.

---

## Spacing & rhythm

Base unit **4px**. Step scale: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 44 · 64 · 96`. Tight within a group, generous between groups; always more space above a heading than below it.

- **Reading surfaces** (Field, Briefing, Debrief): single column, `max-width: 1000px`, page padding `clamp(1.25rem, 5vw, 3.25rem)`.
- **Section breaks:** a hairline `--hairline` with `clamp(2.75rem, 6vw, 4.25rem)` vertical breathing — not a card boundary.
- **Working surface** (Workbench): full viewport width, regions divided by hairlines, each region padded `20–24px`.

---

## Surfaces — when a container is allowed

A container must communicate **grouping, state, hierarchy, or interaction**. "No unnecessary cards" ≠ "never contain." Escalation ladder, cheapest first:

1. **Whitespace only** — default separation between ideas.
2. **Hairline / rule** — 1px `--hairline` to divide peers (mission rows, sections).
3. **Subtle surface** — `--raised` fill, no border or 1px hairline, radius 2px — for a distinct grouped/inspection region (evidence line, record panel, given-resource state).
4. **Contained interactive** — buttons, inputs, the instruction composer: `--raised`/accent fill, hairline, radius 2px.
5. **Elevated inspection layer** — a drawer/sheet for inspecting a mission or full history: `--raised` + real shadow (`0 8px 28px -12px rgba(0,0,0,.28)` — offset **and** blur, never a zero-offset halo). One elevation only.

Zero drop-shadow "floating cards." Nested cards are always wrong.

---

## Geometry

- **Corner radius:** `2px` default (buttons, inputs, subtle surfaces); `0` for hairline dividers and the capability register grid; drawer `2px`. Nothing gets `rounded-2xl`. Do not give everything identical corners — most dividers have none.
- **Buttons:** *primary* = solid `--accent` on `--on-accent`, weight 600, arrow glyph that nudges on hover; *ghost* = 1px `--accent` border, transparent, fills on hover; *quiet* = text + hairline underline on hover (the record opener, "see all").
- **Inputs:** hairline box, radius 2px, `--ground`/`--raised` fill, caret `--accent`, focus ring 2px `--accent` offset 3px. The instruction composer is a bordered field, not a chat bubble bar.
- **Interactive mission objects:** a row on hairlines that shifts `translateX(6px)` and turns its title petrol on hover — object, not card.
- **Inspection surfaces:** `--raised` + hairline. **Border philosophy:** borders are 1px hairlines that *separate*; never a thick colored `border-left` accent stripe.
- **Icons:** drawn SVG (arrows, chevrons, check) in one 1.4–1.5px stroke. No emoji, no sparkles, no ✨ "AI" glyphs.

---

## Mission states (visual language)

| State | Treatment |
|---|---|
| **Recommended** | The figure: Display XL title, petrol-highlighted *because-<gap>* reason, one-line premise, effort·capabilities meta, single solid **Begin**. Dominant by scale + position + whitespace — **not a featured card.** |
| **Available** | Hairline-bounded row: Bricolage 600 title + premise + chevron; hover shifts right + petrol title; expands inline to meta + ghost "Begin this instead". |
| **Being inspected** | Same row expanded (`grid-rows 0fr→1fr`), or an elevated drawer for a deeper look; the recommendation stays one glance away. |
| **Completed** | A lineage entry in the practice record (one layer deeper): muted, names the capabilities it evidenced. Not an activity feed. |
| **Not yet relevant** | Muted title + quiet `not yet relevant` text tag; expands to *why it will surface later*. Never a 🔒 badge. |

No difficulty badges, no tag-pill rows. A label appears only if it changes a decision.

---

## Capability states (accessible, non-analytical)

Five capabilities: **Context · Direction · Iteration · Verification · Synthesis.** State is carried by a **marker glyph + an evidence phrase in words** — never a %, number, bar, or radar. State is never signaled by color or opacity alone (marker shape + text always co-encode it).

| Practice state | Marker | Phrase |
|---|---|---|
| Not yet worked | open ring `○` (`--marker-open`) | "not yet worked" |
| Lightly evidenced | filled dot `●` (`--ink`) | "shown once" |
| Developing | filled dot `●` | "shown in a few reps" |
| Consistently demonstrated | ringed dot `◉` (dot + concentric hairline) | "shown consistently" |
| **Current gap** | open ring in **petrol** | phrase + petrol `· your gap` |

The precise level lives in the phrase; the marker carries worked / not-worked / gap. Inspecting a capability reveals its **evidence line** — the moment(s) it was shown, referenced to real missions, in a `--raised` subtle surface. The gap connects visibly to the recommended assignment.

---

## Motion — restrained, explanatory

Motion explains a state change; it never decorates. Exponential ease-out `cubic-bezier(.16,1,.3,1)` from an already-visible default. All of it collapses under `prefers-reduced-motion: reduce`.

| Moment | Motion |
|---|---|
| Entering a mission / figure appears | `riseIn` — `translateY(10px)`→0 + fade, 0.6–0.72s |
| Giving a resource to the AI | marker checks + row shifts to "given" state, ~0.24s |
| Pulling AI output into the deliverable | brief highlight wash on the target region + settle, ~0.3s |
| Submitting | button recedes into the examining state, quiet fade |
| Examining (post-submit) | one slow breathing hairline reading down the session — not a spinner, not fake analysis |
| Debrief evidence reveal | staggered fade-up of the session line, ~0.4s, one authored moment |
| Next assignment appearing | reuse `riseIn` — the gap resolves into the next rep |

One authored moment per surface. No entrance repeated identically on every element.

---

## Cross-surface guarantees

- Surfaces share the **language** (type, color, geometry, hairlines, motion), **not** a repeated layout. Each of the six gets a composition from its job.
- Browser surfaces carry the world: themed selection, `--accent` caret, hairline scrollbars, 2px petrol focus ring, tabular numerals in data.
- WCAG 2.2 AA: full keyboard paths, visible focus, ≥4.5:1 body contrast, honored reduced motion, state never by color alone.
- Copy treats the operator as a capable professional — names actions and problems; no "Great job!", no coaching clichés, no patronizing encouragement.

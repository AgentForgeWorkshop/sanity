# Writer: final report as a website

After step 4 (REPORT.md is done), also build `report.html`. It is the face of the run.
One person opens it on a projector or a phone and gets the verdict in 2 seconds,
then can drill into any equation. Simplicity first: one page, one idea per block.

## Hard rules
- One self-contained file, `report.html`. Inline all CSS and JS. No build step.
  Allowed CDNs only: KaTeX (css + js) and Google Fonts (Schibsted Grotesk, IBM Plex Mono).
- Embed the data: put `equations.json` and `verdicts.json` verbatim inside
  `<script type="application/json" id="equations">` and `id="verdicts"`. Render from them with JS.
- Every number, value, claim and correction on the page comes from those two files.
  Never invent a counterexample, a correction, a line number or a count. If a field is missing, leave that part out.
- UNCHECKED is shown as UNCHECKED. Never soften FAILS or upgrade UNCHECKED.
- Verdict is never shown by colour alone. Always also the word (HOLDS / FAILS / UNCHECKED / ERROR).
- No external search. Base everything on the two files, like REPORT.md.

## Design (copy the main Sanity site exactly)
```css
:root{
  --bg:#12263a; --ink:#f3efe6; --muted:#d5cec2; --faint:#b7ad9e;
  --line:rgba(243,239,230,.22);
  --holds:#8fa87a; --fails:#c47a6a; --unchecked:var(--faint); --error:#c9a46a;
  --sans:"Schibsted Grotesk","Avenir Next","Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
}
body{background:var(--bg);color:var(--ink);font:1.125rem/1.5 var(--sans)}
```
- Background: the faint 96px grid of the main site
  (`linear-gradient(rgba(243,239,230,.045) 1px,transparent 1px)` both directions, `background-size:96px 96px`).
- Labels, tags, counts: `var(--mono)`, 0.78rem, uppercase, letter-spacing .06em, colour `--faint`.
- Content width `min(68rem, calc(100% - 2rem))`, centred. Thin 1px `--line` rules between sections.
- Verdict rows: 3px left border in the verdict colour, background = that colour at 10% alpha.
  ERROR uses a dashed border. UNCHECKED has no tint, only the faint border.
- No gradients, glow, neon, emoji, shadows, cards-in-cards or icons for decoration.
  Quiet. Honest. Remove friction before pixels.

## Page, top to bottom
1. **Masthead.** Small mono label `SANITY · RUN <slug>`. Paper title as h1. arXiv/source link under it.
   Then the one-sentence judgement (step 3) in `--muted`, max 38em.
2. **Score line.** One mono line: `8 claims · 5 holds · 1 fails · 2 unchecked`.
   Under it, a thin segmented bar (6px high), one segment per claim, in paper order, coloured by verdict.
   Each segment is a link to its claim. On load the segments fill left to right, 40ms apart.
   This is the only animation. Turn it off under `prefers-reduced-motion`.
3. **The catch** (only if any claim FAILS). For the first FAILS claim:
   label `WHAT WE FOUND`, the printed equation (KaTeX, display), then `SHOULD READ`, the corrected equation.
   Then one plain line with the counterexample values from verdicts.json, e.g. `at r+ = 2, r- = 1: printed √2/3, true √2/6`.
   This block is the hero of the page. Big, centred, lots of space.
4. **The paper, checked.** Every claim in paper order, as a row:
   equation label `(4.4)` in mono · rendered equation · verdict word + evidence type (`FAILS · counterexample`).
   Click or Enter expands the row: what was checked, the evidence, and for FAILS the counterexample and
   correction. For HOLDS show the evidence level (proof > symbolic > asymptotic > numerical).
   If the verdict has a check script or Lean file name, show the name in mono. Show code only if it is in the data.
   One row open at a time. Rows are 44px+ tall, keyboard reachable, `aria-expanded` set.
5. **How it was checked.** One line per agent, no more:
   `Reader  extracted N claims` · `Verifier  checked with SymPy / Lean` · `Writer  wrote this page`.
   Use real counts from the files. Add the run's timestamps only if they are in the data.
6. **Footer.** `The LLM proposes. The math decides.` Then, in mono and faint,
   the sha256 of equations.json and verdicts.json (from the handoff header), so anyone can reproduce the run.
   Link back to https://ilkhamfy.github.io/sanity/.

## Must work
- 1280x720 projector: the masthead, score line and the catch fit on the first screen.
- 375px phone: no horizontal scroll; long equations scroll inside their row only.
- Print (Ctrl+P): white background, black text, verdict colours kept, all rows expanded. A referee report on paper.
- Opens straight from the Telegram file with no server.

## Before sending, check
- [ ] Counts on the page equal counts in verdicts.json.
- [ ] Every equation renders (no red KaTeX errors). If one fails, show its raw LaTeX in mono instead.
- [ ] No text, number or claim that is not in the two files.
- [ ] Opened at 375px and 1280px wide.

## Send
In step 6, attach `report.html` next to `REPORT.md` (`MEDIA:<absolute path>`), and add one line to
`telegram.md`: `Open report.html for the checked paper.`

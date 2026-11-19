import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import "./style.css";
import "./papers.css";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subjectsEl = document.querySelector("#subjects");
const totalEl = document.querySelector("#total");
const liveEl = document.querySelector("#live");
const feedEl = document.querySelector("#feed");

let previousTotals = null;
let seen = new Map();
let lastPapers = "";
let lastEvents = "";

function stamp(value) {
  if (!value) return NaN;
  const zoned = /(?:Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`;
  return Date.parse(zoned);
}

function ago(value, now) {
  const then = stamp(value);
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function latest(papers, events, now) {
  const times = [];
  for (const paper of papers) if (paper.checked_at) times.push(paper.checked_at);
  for (const event of events) if (event.time) times.push(event.time);
  if (!times.length) return null;
  return times.reduce((best, time) => (stamp(time) > stamp(best) ? time : best));
}

function isFlagged(paper) {
  return (paper.counts && paper.counts.fails > 0) || (paper.segments || []).includes("FAILS");
}

function pictogram(subject) {
  const name = subject.toLowerCase();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("pict");
  const add = (tag, attrs) => {
    const node = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  };
  if (name.includes("astro") || name.includes("relativ")) {
    add("circle", { cx: "12", cy: "12", r: "3" });
    add("circle", { cx: "12", cy: "12", r: "8" });
  } else if (name.includes("chem")) {
    add("polygon", { points: "12,3 20,8 20,16 12,21 4,16 4,8" });
  } else if (name.includes("math")) {
    add("path", { d: "M5 17 12 5l7 12" });
  } else if (/(^|[^a-z])ml([^a-z]|$)|machine|learning/.test(name)) {
    add("circle", { cx: "6", cy: "8", r: "2" });
    add("circle", { cx: "18", cy: "8", r: "2" });
    add("circle", { cx: "12", cy: "17", r: "2" });
    add("path", { d: "M8 8.5 12 15.2 16 8.5" });
  } else if (name.includes("phys")) {
    add("path", { d: "M3 14c2.2-5 4.6-5 6.8 0s4.6 5 6.8 0 4.6-5 6.4 0" });
  } else {
    add("rect", { x: "5", y: "5", width: "14", height: "14" });
  }
  return svg;
}

function logo(file, label, kind) {
  if (file.endsWith(".svg")) {
    const node = document.createElement("span");
    node.className = `mark-svg ${kind || "tool"}`;
    const mask = `url("./logos/${file}") center / contain no-repeat`;
    node.style.setProperty("-webkit-mask", mask);
    node.style.setProperty("mask", mask);
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", label);
    node.title = label;
    return node;
  }
  const image = document.createElement("img");
  image.className = "mark-img";
  image.src = `./logos/${file}`;
  image.alt = label;
  image.decoding = "async";
  return image;
}

function countText(paper) {
  const counts = paper.counts || {};
  const bits = [];
  if (paper.status === "checking") bits.push("checking");
  if (counts.holds) bits.push(`${counts.holds} hold`);
  if (counts.fails) bits.push(`${counts.fails} fail`);
  if (counts.unchecked) bits.push(`${counts.unchecked} unchecked`);
  if (counts.error) bits.push(`${counts.error} error`);
  const n = (paper.segments || []).length;
  return `${n} claim${n === 1 ? "" : "s"}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
}

function place(paper) {
  const flags = paper.flags || [];
  const pages = [...new Set(flags.map((flag) => flag.page).filter((page) => Number.isInteger(page)))];
  const lines = [...new Set(flags.map((flag) => flag.line).filter((line) => Number.isInteger(line)))];
  const bits = [];
  if (pages.length === 1) bits.push(`p. ${pages[0]}`);
  else if (pages.length > 1) bits.push(`p. ${pages.join(", ")}`);
  if (lines.length === 1) bits.push(`line ${lines[0]}`);
  else if (lines.length > 1) bits.push(`lines ${lines.join(", ")}`);
  return bits.join(" · ");
}

function renderPaper(paper, fresh) {
  const row = document.createElement("article");
  row.className = "row";
  if (fresh && !reduce) row.classList.add("is-fresh");

  if (paper.preview) {
    const figure = document.createElement("figure");
    figure.className = "sheetpic";
    const image = document.createElement("img");
    image.src = `./data/${paper.preview}`;
    image.alt = paper.title || paper.slug;
    image.loading = "lazy";
    image.decoding = "async";
    figure.append(image);
    const where = place(paper);
    if (where) {
      const caption = document.createElement("figcaption");
      caption.className = "where";
      caption.textContent = where;
      figure.append(caption);
    }
    row.append(figure);
  }

  const body = document.createElement("div");
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("h3");
  title.textContent = paper.title || paper.slug;
  head.append(title);
  if ((paper.marks || []).length) {
    const marks = document.createElement("span");
    marks.className = "marks";
    for (const mark of paper.marks) {
      const link = document.createElement("a");
      link.href = mark.href;
      link.rel = "noopener noreferrer";
      const kind = mark.logo.includes("arxiv") ? "arxiv" : mark.logo.includes("springer") ? "springer" : "tool";
      link.append(logo(mark.logo, mark.name, kind));
      marks.append(link);
    }
    head.append(marks);
  }
  if (isFlagged(paper)) {
    const tag = document.createElement("span");
    tag.className = "tag flag";
    tag.textContent = "FLAGGED";
    head.append(tag);
  }
  if (paper.example) {
    const tag = document.createElement("span");
    tag.className = "tag example";
    tag.textContent = "EXAMPLE";
    head.append(tag);
  }
  body.append(head);

  for (const flag of paper.flags || []) {
    const line = document.createElement("p");
    line.className = "flagline";
    line.textContent = `Eq. (${flag.claim}) FAILS${flag.corrected ? " -> corrected" : ""}`;
    body.append(line);
  }

  const bar = document.createElement("div");
  bar.className = "bar";
  if (paper.status === "checking") bar.classList.add("is-checking");
  if (fresh && !reduce) bar.classList.add("is-filling");
  const segments = paper.segments || [];
  segments.forEach((verdict, index) => {
    const seg = document.createElement("span");
    seg.className = "seg";
    seg.dataset.v = verdict;
    seg.title = verdict;
    if (!reduce) seg.style.animationDelay = `${index * 40}ms`;
    bar.append(seg);
  });
  const summary = countText(paper);
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", summary);
  body.append(bar);
  const counts = document.createElement("p");
  counts.className = "counts";
  counts.textContent = summary;
  body.append(counts);

  if ((paper.tools || []).length) {
    const tools = document.createElement("div");
    tools.className = "tools";
    for (const tool of paper.tools) {
      const kind = tool.logo.includes("lean") ? "lean" : "tool";
      tools.append(logo(tool.logo, tool.name, kind));
    }
    body.append(tools);
  }

  const chips = document.createElement("div");
  chips.className = "chips";
  for (const role of ["Reader", "Verifier", "Writer"]) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.append(logo("telegram.svg", "Telegram", "tg"), document.createTextNode(role));
    chips.append(chip);
  }
  body.append(chips);

  const links = document.createElement("p");
  links.className = "links";
  const open = document.createElement("a");
  open.href = `./demo.html?run=${encodeURIComponent(paper.slug)}`;
  open.textContent = "Equations";
  links.append(open);
  if (paper.report) {
    const report = document.createElement("a");
    report.href = `./data/${paper.report}`;
    report.textContent = "Report";
    links.append(report);
  }
  body.append(links);
  row.append(body);

  const flagged = (paper.flags || []).filter((flag) => flag.crop || flag.correction_latex);
  if (flagged.length) {
    for (const flag of flagged) {
      const pair = document.createElement("div");
      pair.className = "pair";
      if (flag.crop) {
        const figure = document.createElement("figure");
        figure.className = "crop";
        const image = document.createElement("img");
        image.src = `./data/${flag.crop}`;
        image.alt = `Equation (${flag.claim}) as printed`;
        image.loading = "lazy";
        image.decoding = "async";
        figure.append(image);
        pair.append(figure);
      }
      if (flag.corrected && flag.correction_latex) {
        const fix = document.createElement("div");
        fix.className = "fix";
        const side = document.createElement("p");
        side.className = "side";
        side.textContent = "Corrected";
        const math = document.createElement("div");
        math.className = "math";
        katex.render(flag.correction_latex, math, { throwOnError: false, displayMode: true });
        fix.append(side, math);
        pair.append(fix);
      }
      if (pair.childElementCount) row.append(pair);
    }
  }

  const lines = paper.telegram && paper.telegram.lines;
  if (lines && lines.length) {
    const list = document.createElement("ul");
    list.className = "chat";
    const who = document.createElement("span");
    who.className = "who";
    who.append(logo("telegram.svg", "Telegram", "tg"), document.createTextNode(paper.telegram.role || "writer"));
    lines.forEach((text, index) => {
      const item = document.createElement("li");
      if (index === 0) item.append(who);
      item.append(document.createTextNode(text));
      list.append(item);
    });
    row.append(list);
  }
  return row;
}

function grouped(papers) {
  const buckets = new Map();
  for (const paper of papers) {
    const subject = typeof paper.subject === "string" ? paper.subject.trim() : "";
    if (!buckets.has(subject)) buckets.set(subject, []);
    buckets.get(subject).push(paper);
  }
  const sections = [...buckets.entries()].filter(([, rows]) => rows.length);
  const rank = (rows) => (rows.some(isFlagged) ? 0 : 1);
  sections.sort((a, b) => rank(a[1]) - rank(b[1]) || a[0].localeCompare(b[0]));
  for (const [, rows] of sections) {
    rows.sort((a, b) => {
      const flags = Number(isFlagged(b)) - Number(isFlagged(a));
      if (flags) return flags;
      return String(b.checked_at || "").localeCompare(String(a.checked_at || ""));
    });
  }
  return sections;
}

function renderFeed(events, now) {
  const rows = [...events].sort((a, b) => stamp(b.time) - stamp(a.time)).slice(0, 8);
  feedEl.replaceChildren();
  if (!rows.length) {
    feedEl.hidden = true;
    return;
  }
  feedEl.hidden = false;
  const title = document.createElement("h2");
  title.textContent = "Activity";
  const list = document.createElement("ol");
  for (const event of rows) {
    const item = document.createElement("li");
    const when = document.createElement("p");
    when.className = "when";
    const relative = ago(event.time, now);
    when.textContent = [event.role, relative].filter(Boolean).join(" · ");
    const what = document.createElement("p");
    what.className = "what";
    what.textContent = event.detail ? `${event.event}. ${event.detail}` : event.event;
    item.append(when, what);
    list.append(item);
  }
  feedEl.append(title, list);
}

function totalText(checked, flagged, claims, checking) {
  const text = `${checked} paper${checked === 1 ? "" : "s"} checked · ${flagged} flagged · ${claims} claim${claims === 1 ? "" : "s"}`;
  return checking ? `${text} · ${checking} checking` : text;
}

function renderTotal(papers) {
  const checking = papers.filter((paper) => paper.status === "checking").length;
  const next = {
    checked: papers.length - checking,
    flagged: papers.filter(isFlagged).length,
    claims: papers.reduce((sum, paper) => sum + (paper.segments || []).length, 0),
    checking,
  };
  const from = previousTotals || (reduce ? next : { checked: 0, flagged: 0, claims: 0, checking });
  previousTotals = next;
  if (reduce || (from.checked === next.checked && from.flagged === next.flagged && from.claims === next.claims)) {
    totalEl.textContent = totalText(next.checked, next.flagged, next.claims, next.checking);
    return;
  }
  const started = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - started) / 800);
    const ease = 1 - (1 - t) ** 3;
    const mix = (key) => Math.round(from[key] + (next[key] - from[key]) * ease);
    totalEl.textContent = totalText(mix("checked"), mix("flagged"), mix("claims"), next.checking);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function render(papers, events, changed) {
  const now = Date.now();
  renderTotal(papers);
  const when = latest(papers, events, now);
  liveEl.textContent = when ? `LIVE · last update ${ago(when, now)}` : "LIVE";
  renderFeed(events, now);
  subjectsEl.replaceChildren();
  for (const [subject, rows] of grouped(papers)) {
    const section = document.createElement("section");
    if (subject) {
      const heading = document.createElement("h2");
      heading.className = "subject";
      heading.append(pictogram(subject), document.createTextNode(subject));
      section.append(heading);
    }
    for (const paper of rows) {
      const fresh = !seen.has(paper.slug) || changed.has(paper.slug);
      section.append(renderPaper(paper, fresh || seen.size === 0));
    }
    subjectsEl.append(section);
  }
  seen = new Map(papers.map((paper) => [paper.slug, JSON.stringify({
    segments: paper.segments,
    status: paper.status,
    counts: paper.counts,
  })]));
}

async function pull() {
  const bust = Date.now();
  const [papersRes, activityRes] = await Promise.all([
    fetch(`./data/papers.json?t=${bust}`),
    fetch(`./data/activity.json?t=${bust}`),
  ]);
  if (!papersRes.ok) throw new Error(String(papersRes.status));
  const papers = (await papersRes.json()).papers || [];
  const events = activityRes.ok ? ((await activityRes.json()).events || []) : [];
  const paperKey = JSON.stringify(papers);
  const eventKey = JSON.stringify(events);
  if (paperKey === lastPapers && eventKey === lastEvents) {
    const now = Date.now();
    const when = latest(papers, events, now);
    liveEl.textContent = when ? `LIVE · last update ${ago(when, now)}` : "LIVE";
    renderFeed(events, now);
    return;
  }
  const changed = new Set();
  if (seen.size) {
    for (const paper of papers) {
      const next = JSON.stringify({ segments: paper.segments, status: paper.status, counts: paper.counts });
      if (seen.get(paper.slug) !== next) changed.add(paper.slug);
    }
  }
  lastPapers = paperKey;
  lastEvents = eventKey;
  render(papers, events, changed);
}

async function start() {
  try {
    await pull();
  } catch {
    totalEl.textContent = "The index did not load.";
  }
}

start();
setInterval(() => {
  pull().catch(() => {});
}, 15000);

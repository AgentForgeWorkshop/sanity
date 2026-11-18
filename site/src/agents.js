const AGENTS = ["reader", "verifier", "writer"];
const TERM = "VERDICT: FAILS (symbolic)";
const NOTE = "Missing ½ on the spring term.";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function curve(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function mountStage() {
  const stage = document.querySelector("[data-stage]");
  if (!stage) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cursors = Object.fromEntries(
    AGENTS.map((name) => [name, stage.querySelector(`[data-cursor="${name}"]`)]),
  );
  const pos = {};
  const at = {};
  let busy = 0;

  const TAG_X = 13;
  const TAG_Y = 15;

  function boxOf(r) {
    const s = stage.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  }

  function inkOf(el) {
    const html = el.querySelector(".katex-html");
    if (!html) return boxOf(el.getBoundingClientRect());
    const range = document.createRange();
    range.selectNodeContents(html);
    return boxOf(range.getBoundingClientRect());
  }

  function hits(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function tagSize(name) {
    const tag = cursors[name].querySelector(".tag");
    return { w: tag.offsetWidth || 58, h: tag.offsetHeight || 16 };
  }

  function pieces(p, name) {
    const { w, h } = tagSize(name);
    const tag = p.flip
      ? { x: p.x - TAG_X - w, y: p.y + TAG_Y, w, h }
      : { x: p.x + TAG_X, y: p.y + TAG_Y, w, h };
    return [{ x: p.x - 1, y: p.y - 1, w: 16, h: 20 }, tag];
  }

  function obstacles(except) {
    const boxes = [];
    stage.querySelectorAll(".math").forEach((el) => boxes.push(inkOf(el)));
    stage.querySelectorAll(".ln, .sheet-top .eyebrow").forEach((el) => {
      boxes.push(boxOf(el.getBoundingClientRect()));
    });
    const flag = stage.querySelector(".flag");
    if (flag) boxes.push(boxOf(flag.getBoundingClientRect()));
    stage.querySelectorAll(".term.is-in, .proved.is-in, .margin-note.is-in").forEach((el) => {
      boxes.push(boxOf(el.getBoundingClientRect()));
    });
    for (const other of AGENTS) {
      if (other === except || !pos[other]) continue;
      boxes.push(...pieces(pos[other], other));
    }
    return boxes.map((b) => ({ x: b.x - 4, y: b.y - 3, w: b.w + 8, h: b.h + 6 }));
  }

  function clearOf(p, name) {
    const mine = pieces(p, name);
    const blocked = obstacles(name).some((o) => mine.some((b) => hits(b, o)));
    if (blocked) return false;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    return mine.every((b) => b.x >= 1 && b.y >= 1 && b.x + b.w <= w - 1 && b.y + b.h <= h - 1);
  }

  function settle(name, p) {
    if (clearOf(p, name)) return p;
    const steps = [10, 18, 28, 40, 56, 72];
    const shifts = [];
    for (const step of steps) {
      shifts.push([step, 0], [-step, 0], [0, step], [0, -step], [step, -step], [-step, -step], [step, step], [-step, step]);
    }
    for (const flip of [p.flip, !p.flip]) {
      for (const [dx, dy] of shifts) {
        const q = { x: p.x + dx, y: p.y + dy, flip };
        if (clearOf(q, name)) return q;
      }
    }
    return p;
  }

  function mathEdge() {
    let edge = 0;
    stage.querySelectorAll(".eqs .math").forEach((el) => {
      const ink = inkOf(el);
      edge = Math.max(edge, ink.x + ink.w);
    });
    return edge + 16;
  }

  function laneFor() {
    return mathEdge();
  }

  function rowTop(id) {
    const line = stage.querySelector(`[data-anchor="${id}"]`).closest(".line");
    return boxOf(line.getBoundingClientRect()).y + 1;
  }

  function preferred(name) {
    const lane = laneFor();
    if (name.startsWith("read-")) {
      return { x: lane, y: rowTop(name), flip: false };
    }
    if (name === "fail-3" || name === "clear-4" || name === "park-verifier") {
      const sheet = boxOf(stage.querySelector(".sheet").getBoundingClientRect());
      const id = name === "clear-4" ? "read-4" : name === "park-verifier" ? "read-2" : "read-3";
      return { x: sheet.x + sheet.w - 22, y: rowTop(id), flip: true };
    }
    if (name === "units-4") {
      const flag = boxOf(stage.querySelector('[data-anchor="units-4"]').getBoundingClientRect());
      return { x: flag.x - 22, y: rowTop("read-4"), flip: true };
    }
    if (name === "park-reader") {
      return { x: lane, y: Math.max(4, rowTop("read-1") - 28), flip: false };
    }
    const spot = boxOf(stage.querySelector(`[data-anchor="${name}"]`).getBoundingClientRect());
    return { x: spot.x, y: spot.y, flip: name === "park-writer" };
  }

  function anchor(agent, dest) {
    return settle(agent, preferred(dest));
  }

  function place(name, p) {
    pos[name] = p;
    const node = cursors[name];
    node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    node.classList.toggle("is-flip", !!p.flip);
  }

  function ripple(name) {
    if (reduce || !pos[name]) return;
    const el = document.createElement("span");
    el.className = "ripple";
    el.style.left = `${pos[name].x}px`;
    el.style.top = `${pos[name].y + 3}px`;
    el.style.color = getComputedStyle(cursors[name]).color;
    stage.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function holdPositions() {
    for (const name of AGENTS) {
      if (!at[name]) continue;
      place(name, anchor(name, at[name]));
    }
  }

  function focusCursor(name) {
    for (const key of AGENTS) cursors[key].classList.toggle("is-active", key === name);
  }

  function phase(name) {
    stage.dataset.phase = name || "idle";
    document.querySelectorAll("[data-role]").forEach((card) => {
      card.classList.toggle("is-live", card.dataset.role === name);
    });
  }

  function chip(id) {
    return stage.querySelector(`[data-chip="${id}"]`);
  }

  function show(id) {
    chip(id).classList.add("is-in");
  }

  function mark(n, kind) {
    const line = stage.querySelector(`[data-line="${n}"]`);
    if (kind === "read") {
      stage.querySelectorAll(".line.is-current").forEach((el) => el.classList.remove("is-current"));
      line.classList.add("is-read", "is-current");
      ripple("reader");
      return;
    }
    line.classList.add(`is-${kind}`);
    ripple("verifier");
  }

  function hideScene() {
    stage.querySelectorAll("[data-chip]").forEach((el) => {
      el.classList.remove("is-in", "is-typing");
    });
    stage.querySelectorAll("[data-typed]").forEach((el) => {
      el.textContent = "";
    });
    stage.querySelectorAll("[data-line]").forEach((el) => {
      el.classList.remove("is-read", "is-current", "is-fail", "is-units");
    });
  }

  function hold(ms) {
    busy += 1;
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        holdPositions();
        if (now - start < ms) requestAnimationFrame(frame);
        else {
          busy -= 1;
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  function glide(name, dest) {
    const from = { ...pos[name] };
    const first = anchor(name, dest);
    const dist = Math.hypot(first.x - from.x, first.y - from.y);
    if (dist < 3) {
      at[name] = dest;
      place(name, first);
      return Promise.resolve();
    }
    const ms = Math.max(560, Math.min(1180, 420 + dist * 1.05));
    const ease = easeOutCubic;
    const target = first;
    busy += 1;
    return new Promise((resolve) => {
      const start = performance.now();
      let x = from.x;
      let y = from.y;
      const frame = (now) => {
        const raw = Math.min(1, (now - start) / ms);
        const goal = raw === 1 ? target : curve(from, target, ease(raw));
        const follow = raw > 0.94 ? 1 : 0.36;
        x += (goal.x - x) * follow;
        y += (goal.y - y) * follow;
        place(name, { x, y, flip: target.flip });
        if (raw < 1) requestAnimationFrame(frame);
        else {
          at[name] = dest;
          place(name, target);
          busy -= 1;
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  function typeInto(id, text, per) {
    const typed = stage.querySelector(`[data-typed="${id}"]`);
    const node = typed.closest("[data-chip]");
    node.classList.add("is-in", "is-typing");
    const total = text.length * per;
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        holdPositions();
        const t = Math.min(1, (now - start) / total);
        typed.textContent = text.slice(0, Math.ceil(t * text.length));
        if (t < 1) requestAnimationFrame(frame);
        else {
          typed.textContent = text;
          node.classList.remove("is-typing");
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  function boot(map) {
    for (const name of AGENTS) {
      at[name] = map[name];
      place(name, anchor(name, map[name]));
    }
    stage.classList.add("is-ready");
  }

  function showFinal() {
    stage.classList.add("is-static");
    for (const n of [1, 2, 3, 4, 5]) mark(n, "read");
    stage.querySelectorAll(".line.is-current").forEach((el) => el.classList.remove("is-current"));
    mark(3, "fail");
    mark(4, "units");
    show("proof");
    chip("term").querySelector("[data-typed]").textContent = TERM;
    show("term");
    show("badge");
    show("units");
    chip("note").querySelector("[data-typed]").textContent = NOTE;
    show("note");
    boot({ reader: "read-5", verifier: "units-4", writer: "note" });
    focusCursor("writer");
    phase("writer");
  }

  async function clearScene() {
    stage.classList.add("is-clearing");
    await hold(360);
    hideScene();
    await hold(460);
    stage.classList.remove("is-clearing");
    focusCursor("");
    phase("");
    await Promise.all(AGENTS.map((name) => glide(name, `park-${name}`)));
    await hold(480);
  }

  async function loop() {
    boot({
      reader: "park-reader",
      verifier: "park-verifier",
      writer: "park-writer",
    });
    while (true) {
      phase("reader");
      focusCursor("reader");
      const dwell = [150, 170, 140, 190, 220];
      for (let n = 1; n <= 5; n += 1) {
        await glide("reader", `read-${n}`);
        mark(n, "read");
        await hold(dwell[n - 1]);
      }
      await hold(420);
      stage.querySelectorAll(".line.is-current").forEach((el) => el.classList.remove("is-current"));
      phase("verifier");
      focusCursor("verifier");
      await glide("verifier", "fail-3");
      mark(3, "fail");
      show("proof");
      await typeInto("term", TERM, 36);
      await hold(280);
      show("badge");
      await hold(640);
      await glide("verifier", "clear-4");
      await glide("verifier", "units-4");
      mark(4, "units");
      show("units");
      await hold(460);
      phase("writer");
      focusCursor("writer");
      await glide("writer", "note");
      await typeInto("note", NOTE, 40);
      await hold(2100);
      await clearScene();
    }
  }

  const start = () => {
    if (reduce) showFinal();
    else loop();
  };

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  else start();

  const ro = new ResizeObserver(() => {
    if (busy === 0) holdPositions();
  });
  ro.observe(stage);
}

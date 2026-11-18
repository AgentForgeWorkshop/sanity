const AGENTS = ["reader", "verifier", "writer"];
const TERM = "sympy ... VERDICT: FAILED";
const NOTE = "Missing ½ on the spring term.";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeOutBack(t) {
  const c = 0.55;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function curve(a, b, t, bow) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const mag = Math.min(24, len * 0.16) * bow;
  const nx = -dy / len;
  const ny = dx / len;
  const c1x = a.x + dx * 0.34 + nx * mag;
  const c1y = a.y + dy * 0.08 + ny * mag;
  const c2x = a.x + dx * 0.7 + nx * mag * 0.3;
  const c2y = a.y + dy * 0.9 + ny * mag * 0.12;
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y,
  };
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
  let bow = 1;
  let busy = 0;

  const shifted = {
    "fail-3": { name: "read-3", ax: 1, ay: 0.15 },
  };

  function anchor(name) {
    const spec = shifted[name];
    const el = stage.querySelector(`[data-anchor="${spec ? spec.name : name}"]`);
    const s = stage.getBoundingClientRect();
    const html = el.matches(".math") ? el.querySelector(".katex-html") : null;
    let r;
    if (html) {
      const range = document.createRange();
      range.selectNodeContents(html);
      r = range.getBoundingClientRect();
    } else {
      r = el.getBoundingClientRect();
    }
    const ax = spec ? spec.ax : Number(el.dataset.ax ?? 0);
    const ay = spec ? spec.ay : Number(el.dataset.ay ?? 0);
    return {
      x: r.left - s.left + r.width * ax,
      y: r.top - s.top + r.height * ay,
    };
  }

  function place(name, p) {
    pos[name] = p;
    const node = cursors[name];
    node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    const tag = node.querySelector(".tag");
    const need = p.x + tag.offsetWidth + 18 > stage.clientWidth;
    const flipped = node.classList.contains("is-flip");
    if (need && !flipped) node.classList.add("is-flip");
    else if (!need && flipped && p.x + tag.offsetWidth + 40 < stage.clientWidth) {
      node.classList.remove("is-flip");
    }
  }

  function holdPositions() {
    for (const name of AGENTS) {
      if (!at[name]) continue;
      place(name, anchor(at[name]));
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
      return;
    }
    line.classList.add(`is-${kind}`);
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
    const first = anchor(dest);
    const dist = Math.hypot(first.x - from.x, first.y - from.y);
    if (dist < 3) {
      at[name] = dest;
      place(name, first);
      return Promise.resolve();
    }
    const ms = Math.max(560, Math.min(1180, 420 + dist * 1.05));
    const side = bow;
    bow *= -1;
    const ease = dist > 56 ? easeOutBack : easeOutCubic;
    busy += 1;
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        const raw = Math.min(1, (now - start) / ms);
        const target = anchor(dest);
        const p = raw === 1 ? target : curve(from, target, ease(raw), side);
        place(name, p);
        if (raw < 1) requestAnimationFrame(frame);
        else {
          at[name] = dest;
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
      place(name, anchor(map[name]));
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

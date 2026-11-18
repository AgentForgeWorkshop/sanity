import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { AnimatedBeam } from "../components/magicui/animated-beam";
import { BorderBeam } from "../components/magicui/border-beam";
import { MagicCard } from "../components/magicui/magic-card";
import { Terminal } from "../components/magicui/terminal";
import { AgentCursor, CursorGlyph } from "../components/aceternity/cursors";
import { Math } from "../components/katex";
import { cn } from "../lib/utils";

const AGENTS = [
  { id: "reader", name: "Reader", color: "#2f7d74", status: "reading", job: "Lifts every equation from the paper." },
  { id: "verifier", name: "Verifier", color: "#b5523c", status: "verifying", job: "Screens the step. A verdict is HOLDS, FAILS, or UNCHECKED." },
  { id: "writer", name: "Writer", color: "#3f6294", status: "writing", job: "Notes the correction. It does not change a verdict." },
];

const EQS = [
  { n: 1, tex: "m\\ddot{x}=-kx" },
  { n: 2, tex: "m\\dot{x}\\,\\ddot{x}+kx\\dot{x}=0" },
  { n: 3, tex: "E=\\tfrac{1}{2}mv^{2}+kx^{2}" },
  { n: 4, tex: "\\tau=b/m" },
  { n: 5, tex: "\\omega_{0}=\\sqrt{k/m}" },
];

const LINES = [
  "sympy check eq(3) ... VERDICT: FAILS (symbolic)",
  "lean ... refutation ✓",
];

export function Agents() {
  const beam = useRef(null);
  const paper = useRef(null);
  const reader = useRef(null);
  const verifier = useRef(null);
  const writer = useRef(null);
  const telegram = useRef(null);
  const panel = useRef(null);
  const lineRefs = useRef([]);
  const [live, setLive] = useState("reader");
  const [current, setCurrent] = useState(1);
  const [failed, setFailed] = useState(false);
  const [cursors, setCursors] = useState({
    reader: { x: 24, y: 16, flip: false },
    verifier: { x: 180, y: 16, flip: true },
    writer: { x: 24, y: 150, flip: false },
  });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stop = false;
    const sleep = (ms) => new Promise((resolve) => {
      window.setTimeout(resolve, stop ? 0 : ms);
    });

    const spot = (index, dx = 14) => {
      const line = lineRefs.current[index];
      const box = panel.current?.getBoundingClientRect();
      if (!line || !box) return null;
      const row = line.getBoundingClientRect();
      const html = line.querySelector(".katex-html");
      let right = row.left + 64;
      if (html) {
        const range = document.createRange();
        range.selectNodeContents(html);
        const ink = range.getBoundingClientRect();
        if (ink.width > 8) right = ink.right;
      }
      let x = right - box.left + dx;
      let flip = false;
      if (x > box.width - 96) {
        x = box.width - 22;
        flip = true;
      }
      return { x, y: row.top - box.top + 8, flip };
    };

    const place = (name, point) => {
      if (!point) return;
      setCursors((prev) => ({ ...prev, [name]: point }));
    };

    const noteSpot = () => {
      const box = panel.current?.getBoundingClientRect();
      const note = panel.current?.querySelector("[data-note]");
      if (!box || !note) return null;
      const range = document.createRange();
      range.selectNodeContents(note);
      const ink = range.getBoundingClientRect();
      let x = ink.right - box.left + 16;
      let flip = false;
      if (x > box.width - 96) {
        x = box.width - 22;
        flip = true;
      }
      return { x, y: ink.top - box.top + 2, flip };
    };

    const run = async () => {
      place("verifier", (() => {
        const box = panel.current?.getBoundingClientRect();
        const note = panel.current?.querySelector("[data-note]");
        if (!box || !note) return null;
        return { x: box.width - 22, y: note.getBoundingClientRect().top - box.top + 2, flip: true };
      })());
      place("writer", (() => {
        const parked = spot(4, 0);
        const box = panel.current?.getBoundingClientRect();
        if (!parked || !box) return null;
        return { x: box.width - 22, y: parked.y, flip: true };
      })());
      if (reduce) {
        setLive("writer");
        setCurrent(5);
        setFailed(true);
        place("reader", spot(4, 16));
        place("verifier", spot(3, 78));
        place("writer", noteSpot());
        return;
      }
      while (!stop) {
        setFailed(false);
        setLive("reader");
        for (let i = 0; i < EQS.length; i += 1) {
          if (stop) return;
          place("reader", spot(i, 18));
          setCurrent(i + 1);
          await sleep(700);
        }
        setLive("verifier");
        place("verifier", spot(2, 86));
        setFailed(true);
        await sleep(2200);
        place("verifier", spot(3, 86));
        await sleep(900);
        setLive("writer");
        place("writer", noteSpot());
        await sleep(2200);
      }
    };
    const id = window.setTimeout(run, 300);
    return () => {
      stop = true;
      clearTimeout(id);
    };
  }, []);

  const nodes = [
    { ref: paper, label: "Paper", color: "#9ec8da", icon: <FileText className="size-4" /> },
    { ref: reader, label: "Reader", color: "#2f7d74" },
    { ref: verifier, label: "Verifier", color: "#b5523c" },
    { ref: writer, label: "Writer", color: "#3f6294" },
    { ref: telegram, label: "Telegram", color: "#26A5E4", icon: <img src="logos/telegram.svg" alt="" className="size-4" /> },
  ];

  return (
    <section aria-labelledby="agents-title">
      <div className="mx-auto w-full max-w-5xl px-4">
        <p className="text-xs tracking-wide text-white/45 uppercase">Agents</p>
        <h2 id="agents-title" className="mt-1 text-2xl font-medium tracking-tight">Three agents</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Example data. Beams follow the handoff. Verdicts are HOLDS, FAILS, or UNCHECKED, each with an evidence kind.
        </p>

        <div ref={beam} className="relative mt-6 flex items-start justify-between gap-2">
          {nodes.map((node) => (
            <div key={node.label} className="flex flex-col items-center gap-2">
              <div
                ref={node.ref}
                className="relative z-10 grid size-11 place-items-center rounded-full border border-white/15 text-white shadow-[0_0_0_4px_rgba(7,13,22,0.8)]"
                style={{ background: node.color }}
              >
                {node.icon || <span className="text-sm font-medium">{node.label.slice(0, 1)}</span>}
              </div>
              <span className="text-[11px] text-white/70">{node.label}</span>
            </div>
          ))}
          {nodes.slice(0, -1).map((node, index) => (
            <AnimatedBeam
              key={node.label}
              containerRef={beam}
              fromRef={node.ref}
              toRef={nodes[index + 1].ref}
              delay={index * 0.7}
              duration={2.4}
              gradientStartColor={node.color}
              gradientStopColor={nodes[index + 1].color}
            />
          ))}
        </div>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          <div ref={panel} className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c1624]">
            <BorderBeam colorFrom="#9ec8da" colorTo="#3f6294" />
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] tracking-wide text-white/40 uppercase">
              <span>Example</span>
              <span>Damped oscillator</span>
            </div>
            <div className="space-y-0.5 px-2 py-2">
              {EQS.map((eq, index) => (
                <div
                  key={eq.n}
                  ref={(node) => { lineRefs.current[index] = node; }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1",
                    current === eq.n && live === "reader" && "bg-[#2f7d74]/15",
                    failed && eq.n === 3 && "bg-[#b5523c]/15",
                  )}
                >
                  <span className="w-8 font-mono text-xs text-white/35">({eq.n})</span>
                  <Math tex={eq.tex} />
                  {failed && eq.n === 4 && (
                    <span className="ml-auto font-mono text-[10px] tracking-widest text-[#e7b2a6] uppercase">units</span>
                  )}
                </div>
              ))}
              <p data-note className="px-2 pt-2 font-mono text-xs text-[#9bb4d4]">Missing ½ on the spring term.</p>
            </div>
            <AgentCursor name="Reader" color="#2f7d74" active={live === "reader"} {...cursors.reader} />
            <AgentCursor name="Verifier" color="#b5523c" active={live === "verifier"} {...cursors.verifier} />
            <AgentCursor name="Writer" color="#3f6294" active={live === "writer"} {...cursors.writer} />
          </div>
          <Terminal lines={LINES} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {AGENTS.map((agent) => (
            <MagicCard key={agent.id} active={live === agent.id}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg" style={{ background: agent.color }}>
                  <CursorGlyph />
                </span>
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className={cn("font-mono text-[11px] text-white/45", live === agent.id && "text-white")}>{agent.status}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/70">{agent.job}</p>
            </MagicCard>
          ))}
        </div>
      </div>
    </section>
  );
}

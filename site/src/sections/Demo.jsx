import { useEffect, useState } from "react";
import { Math } from "../components/katex";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../lib/utils";

const STEPS = [
  { at: 400, say: "Reader. Five equations from the example note." },
  { at: 1800, say: "Verifier. Equation 3 FAILS (symbolic).", focus: "3" },
  { at: 3400, say: "Verifier. Lean: refutation.", show: true },
  { at: 5000, say: "Writer. The spring term is missing a half.", show: true },
  { at: 6800, say: "Verifier. Equation 4 FAILS (symbolic). The decay time is 2m/b.", focus: "4", also: true },
];

export function Demo() {
  const [status, setStatus] = useState("");
  const [focus, setFocus] = useState("");
  const [open, setOpen] = useState(false);
  const [also, setAlso] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let timers = [];
    const start = () => {
      timers.forEach((id) => clearTimeout(id));
      timers = [];
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setRunning(true);
      setOpen(false);
      setAlso(false);
      setFocus("");
      const finish = STEPS[STEPS.length - 1];
      if (reduce) {
        setStatus(finish.say);
        setFocus(finish.focus);
        setOpen(true);
        setAlso(true);
        setRunning(false);
        return;
      }
      for (const step of STEPS) {
        timers.push(window.setTimeout(() => {
          setStatus(step.say);
          if (step.focus) setFocus(step.focus);
          if (step.show) setOpen(true);
          if (step.also) setAlso(true);
        }, step.at));
      }
      timers.push(window.setTimeout(() => setRunning(false), 8200));
    };
    window.addEventListener("sanity:demo", start);
    return () => {
      window.removeEventListener("sanity:demo", start);
      timers.forEach((id) => clearTimeout(id));
    };
  }, []);

  return (
    <section id="demo" aria-labelledby="demo-title" className="scroll-mt-6">
      <div className="mx-auto w-full max-w-5xl px-4">
        <p id="demo-note" className="text-xs tracking-wide text-white/45 uppercase">Example data. Not a real paper.</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 id="demo-title" className="text-2xl font-medium tracking-tight">A spring, missing a half.</h2>
          <button type="button" className={cn(buttonVariants({ variant: "outline" }))} disabled={running} onClick={() => window.dispatchEvent(new Event("sanity:demo"))}>
            {running ? "Running" : status ? "Run again" : "Run the demo"}
          </button>
        </div>
        <article className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4" aria-label="Example note">
          {["1", "2", "3"].map((id) => (
            <Eq key={id} n={id} tex={EQ[id]} dim={focus && focus !== id} hot={focus === id} />
          ))}
          {open && (
            <div className="my-3 grid gap-3 rounded-lg border border-white/10 bg-[#0b1522] p-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-white/45">Wrong</p>
                <Math tex="E=\tfrac{1}{2}mv^{2}+kx^{2}" />
              </div>
              <div>
                <p className="mb-1 text-xs text-white/45">Right</p>
                <Math tex="E=\tfrac{1}{2}mv^{2}+\tfrac{1}{2}kx^{2}" />
              </div>
              <p className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#b5523c]/50 px-2 py-1 font-mono text-xs text-[#e7b2a6] md:col-span-2">
                <Check /> Lean: refutation
              </p>
              {also && (
                <p className="text-sm text-white/75 md:col-span-2">
                  One more. <Math tex="\tau=b/m" display={false} /> is a rate, not a time. The decay time is <Math tex="2m/b" display={false} />.
                </p>
              )}
            </div>
          )}
          {["4", "5"].map((id) => (
            <Eq key={id} n={id} tex={EQ[id]} dim={focus && focus !== id} hot={focus === id} />
          ))}
        </article>
        <p className="mt-3 min-h-6 text-sm text-white/70" aria-live="polite">{status}</p>
      </div>
    </section>
  );
}

const EQ = {
  1: "m\\ddot{x}=-kx",
  2: "m\\dot{x}\\,\\ddot{x}+kx\\dot{x}=0",
  3: "E=\\tfrac{1}{2}mv^{2}+kx^{2}",
  4: "\\tau=b/m",
  5: "\\omega_{0}=\\sqrt{k/m}",
};

function Eq({ n, tex, dim, hot }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-md px-2 py-1 transition-opacity", dim && "opacity-35", hot && "bg-white/[0.04]")}>
      <span className="w-8 font-mono text-xs text-white/40">({n})</span>
      <Math tex={tex} />
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M2.2 6.1 4.8 8.7 9.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

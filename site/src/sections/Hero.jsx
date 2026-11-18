import { buttonVariants } from "../components/ui/button";
import { AnimatedGradientText } from "../components/magicui/animated-gradient-text";
import { BorderBeam } from "../components/magicui/border-beam";
import { RetroGrid } from "../components/magicui/retro-grid";
import { ShimmerButton } from "../components/magicui/shimmer-button";
import { Math } from "../components/katex";
import { cn } from "../lib/utils";

const REPO = "https://github.com/IlkhamFY/sanity";

export function Hero({ onRun }) {
  return (
    <section className="relative overflow-hidden" aria-labelledby="pitch">
      <RetroGrid />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-10 text-center md:pt-14">
        <img src="brand/logo-dark.svg" width="466" height="128" alt="Sanity" className="mb-6 h-9 w-auto" />
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <span className="size-1.5 rounded-full bg-[#9ec8da]" />
          Built at AgentForge 2026
        </p>
        <h1 id="pitch" className="max-w-3xl text-4xl leading-[1.05] font-medium tracking-tight text-balance md:text-6xl">
          Your paper&apos;s math,{" "}
          <AnimatedGradientText>double-checked.</AnimatedGradientText>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65 md:text-base">
          Example data, not a real paper. A Reader lifts each equation. A Verifier screens it. A step stands only on a verdict: HOLDS, FAILS, or UNCHECKED.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ShimmerButton onClick={onRun}>Run the demo</ShimmerButton>
          <a className={cn(buttonVariants({ variant: "outline", size: "lg" }))} href={REPO} target="_blank" rel="noopener noreferrer">
            <img src="logos/github.svg" alt="" className="size-4 invert" />
            GitHub
          </a>
        </div>

        <div className="relative mt-8 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0b1522]/80 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <BorderBeam />
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] tracking-wide text-white/45 uppercase">
            <span>Example</span>
            <span>Damped oscillator</span>
          </div>
          <div className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-1">
              <PreviewLine n="(3)" tex="E=\tfrac{1}{2}mv^{2}+kx^{2}" hot />
              <p className="ml-8 inline-flex rounded-md bg-[#101820] px-2 py-1 font-mono text-[11px] text-[#e7eef2]">
                VERDICT: FAILS (symbolic)
              </p>
            </div>
            <p className="hidden border-l border-white/10 pl-4 font-mono text-xs text-[#9ec8da] md:block">
              Lean: refutation
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewLine({ n, tex, hot }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-md px-2 py-1", hot && "bg-[#b5523c]/10")}>
      <span className="w-8 font-mono text-xs text-white/40">{n}</span>
      <Math tex={tex} />
    </div>
  );
}

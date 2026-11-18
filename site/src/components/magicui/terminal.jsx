import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

/** Magic UI Terminal (MIT). Types each line, then repeats. */
export function Terminal({ lines, className, onStep }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [count, setCount] = useState(reduce ? lines.join("\n").length : 0);
  const text = lines.join("\n");
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  useEffect(() => {
    if (reduce) {
      stepRef.current?.(lines.length);
      return;
    }
    let frame;
    let start;
    const ms = Math.max(900, text.length * 28);
    const tick = (now) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / ms);
      const next = Math.ceil(t * text.length);
      setCount(next);
      const typed = text.slice(0, next);
      stepRef.current?.(typed.split("\n").length);
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        frame = window.setTimeout(() => {
          start = undefined;
          setCount(0);
          frame = requestAnimationFrame(tick);
        }, 1600);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(frame);
    };
  }, [reduce, text, lines.length]);

  const shown = text.slice(0, count);
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/10 bg-[#070d14] font-mono text-[12.5px] leading-relaxed text-[#d5e4ea]", className)}>
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="ml-2 text-[10px] tracking-wide text-white/40">example check</span>
      </div>
      <pre className="m-0 min-h-24 px-3 py-3 text-[11.5px] leading-5 whitespace-pre-wrap">
        {shown}
        <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-[#9ec8da]" />
      </pre>
    </div>
  );
}

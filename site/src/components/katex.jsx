import { useEffect, useRef } from "react";
import katex from "katex";
import { cn } from "../lib/utils";

export function Math({ tex, display = true, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    katex.render(tex, ref.current, {
      throwOnError: false,
      displayMode: display,
      output: "html",
    });
  }, [tex, display]);
  return <span ref={ref} className={cn("text-foreground", className)} />;
}

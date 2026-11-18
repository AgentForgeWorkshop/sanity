import { useRef } from "react";
import { cn } from "../../lib/utils";

/** Magic UI Magic Card spotlight (MIT). */
export function MagicCard({ className, children, active = false }) {
  const ref = useRef(null);
  const move = (event) => {
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    node.style.setProperty("--x", `${event.clientX - box.left}px`);
    node.style.setProperty("--y", `${event.clientY - box.top}px`);
  };
  return (
    <article
      ref={ref}
      onMouseMove={move}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4",
        active && "border-white/25 bg-white/[0.05]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(280px circle at var(--x, 50%) var(--y, 0%), rgba(158,200,218,0.16), transparent 45%)" }}
      />
      <div className="relative">{children}</div>
    </article>
  );
}

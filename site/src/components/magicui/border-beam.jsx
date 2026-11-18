import { cn } from "../../lib/utils";

/** Magic UI Border Beam (MIT). */
export function BorderBeam({ className, size = 140, duration = 8, colorFrom = "#9ec8da", colorTo = "#2f7d74" }) {
  return (
    <div
      aria-hidden="true"
      style={{
        "--size": `${size}px`,
        "--duration": `${duration}s`,
        "--color-from": colorFrom,
        "--color-to": colorTo,
      }}
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]",
        className,
      )}
    >
      <div className="absolute aspect-square w-[var(--size)] animate-border-beam [offset-path:rect(0_auto_auto_0_round_16px)] [background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]" />
    </div>
  );
}

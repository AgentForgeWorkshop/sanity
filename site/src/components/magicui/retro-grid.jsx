import { cn } from "../../lib/utils";

/** Magic UI Retro Grid (MIT). */
export function RetroGrid({ className }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden opacity-60 [perspective:220px]", className)} aria-hidden="true">
      <div className="absolute inset-0 [transform:rotateX(62deg)]">
        <div
          className="animate-grid absolute inset-x-[-50%] top-0 h-[300%] w-[200%] [background-image:linear-gradient(to_right,rgba(158,200,218,0.28)_1px,transparent_1px),linear-gradient(to_bottom,rgba(158,200,218,0.28)_1px,transparent_1px)] [background-size:52px_52px] [transform-origin:top_center]"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  );
}

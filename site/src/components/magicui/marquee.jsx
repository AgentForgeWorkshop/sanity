import { cn } from "../../lib/utils";

/** Magic UI Marquee (MIT). */
export function Marquee({ children, className }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="flex w-max animate-marquee gap-3 pr-3">
        {children}
        {children}
      </div>
    </div>
  );
}

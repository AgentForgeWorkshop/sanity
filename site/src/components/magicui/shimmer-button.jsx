import { cn } from "../../lib/utils";

/** Magic UI Shimmer Button (MIT). */
export function ShimmerButton({ className, children, ...props }) {
  return (
    <button
      className={cn(
        "relative inline-flex h-11 items-center justify-center overflow-hidden rounded-full px-5 text-sm font-medium text-[#071018] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        className,
      )}
      {...props}
    >
      <span className="absolute inset-0 bg-[#e7eef2]" />
      <span className="absolute inset-y-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white to-transparent" />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

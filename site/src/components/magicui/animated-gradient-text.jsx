import { cn } from "../../lib/utils";

/** Magic UI Animated Gradient Text (MIT). */
export function AnimatedGradientText({ children, className }) {
  return (
    <span
      className={cn(
        "animate-gradient inline bg-[linear-gradient(90deg,#9ec8da,#f4fbff,#2f7d74,#9ec8da)] bg-[length:200%_auto] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}

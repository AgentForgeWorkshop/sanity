import { useEffect, useId, useState } from "react";
import { cn } from "../../lib/utils";

/** Magic UI Animated Beam (MIT). */
export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  duration = 3,
  delay = 0,
  pathColor = "rgba(231,238,242,0.32)",
  pathWidth = 2,
  gradientStartColor = "#9ec8da",
  gradientStopColor = "#2f7d74",
}) {
  const id = useId();
  const [path, setPath] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      const container = containerRef.current;
      const from = fromRef.current;
      const to = toRef.current;
      if (!container || !from || !to) return;
      const box = container.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      setSize({ width: box.width, height: box.height });
      const startX = a.left - box.left + a.width / 2;
      const startY = a.top - box.top + a.height / 2;
      const endX = b.left - box.left + b.width / 2;
      const endY = b.top - box.top + b.height / 2;
      const midX = (startX + endX) / 2;
      const midY = startY - curvature;
      setPath(`M ${startX},${startY} Q ${midX},${midY} ${endX},${endY}`);
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, fromRef, toRef, curvature]);

  return (
    <svg
      fill="none"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden="true"
    >
      <path d={path} stroke={pathColor} strokeWidth={pathWidth} strokeLinecap="round" />
      <path d={path} stroke={`url(#${id})`} strokeWidth={pathWidth} strokeLinecap="round" />
      <defs>
        <linearGradient id={id} gradientUnits="objectBoundingBox" x1="0%" x2="20%">
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="40%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
          <animate attributeName="x1" values="-40%;100%" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
          <animate attributeName="x2" values="-20%;120%" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
        </linearGradient>
      </defs>
    </svg>
  );
}

import { cn } from "../../lib/utils";

const PATH = "M3.15 1.45c-.95-.1-1.7.75-1.35 1.65l.85 10.2c.08.5.62.75 1.05.45l1.7-1.55 2.25 5.35c.28.62 1.12.52 1.28-.16l.75-2.05c.12-.4-.12-.82-.52-.9l-2.15-.7 4.45-.6c.62-.08.84-.88.36-1.28L4.15 2.2c-.32-.28-.68-.7-1-.75z";

/** Aceternity-style multiplayer cursor: rounded pointer, white edge, name pill. */
export function AgentCursor({ name, color, x = 0, y = 0, flip = false, active = false }) {
  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20"
      style={{ transform: `translate3d(${x}px, ${y}px, 0)`, color }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 20"
        width="16"
        height="20"
        className={cn("overflow-visible drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]", active ? "opacity-100" : "opacity-80")}
      >
        <path d={PATH} fill="currentColor" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span
        className={cn(
          "absolute top-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap text-[#f4f7f8] shadow-[0_6px_14px_rgba(0,0,0,0.35)]",
          flip ? "right-4" : "left-4",
        )}
        style={{ background: color }}
      >
        {name}
      </span>
    </div>
  );
}

export function CursorGlyph({ className }) {
  return (
    <svg viewBox="0 0 16 20" width="13" height="16" className={className} aria-hidden="true">
      <path d={PATH} fill="#f4f7f8" stroke="rgba(255,255,255,0.9)" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

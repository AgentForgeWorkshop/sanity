import { Marquee } from "../components/magicui/marquee";

const MARKS = [
  { name: "Python", href: "https://www.python.org/", logo: "logos/python.svg" },
  { name: "SymPy", href: "https://www.sympy.org/", logo: "logos/sympy.svg" },
  { name: "Lean 4", href: "https://lean-lang.org/", logo: "logos/lean.svg", wide: true },
  { name: "Mathlib", href: "https://github.com/leanprover-community/mathlib4" },
  { name: "KaTeX", href: "https://katex.org/", logo: "logos/katex.svg", wide: true },
  { name: "LaTeX", href: "https://www.latex-project.org/", logo: "logos/latex.svg" },
  { name: "Telegram", href: "https://telegram.org/", logo: "logos/telegram.svg" },
  { name: "Hermes", href: "https://nousresearch.com/" },
  { name: "Vite", href: "https://vite.dev/", logo: "logos/vite.svg" },
  { name: "Cursor", href: "https://cursor.com/", logo: "logos/cursor.svg" },
  { name: "GitHub", href: "https://github.com/", logo: "logos/github.svg" },
];

export function BuiltWith() {
  return (
    <section aria-labelledby="built-title">
      <div className="mx-auto w-full max-w-5xl px-4">
        <h2 id="built-title" className="mb-4 text-sm font-medium tracking-wide text-white/60">Built with</h2>
        <div className="relative">
          <Marquee>
            {MARKS.map((mark) => (
              <a
                key={mark.name}
                href={mark.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 min-w-28 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white/80 grayscale transition hover:bg-white/[0.06] hover:grayscale-0"
              >
                {mark.logo && (
                  <img src={mark.logo} alt="" className={mark.wide ? "h-4 w-12 object-contain" : "size-5 object-contain"} />
                )}
                <span>{mark.name}</span>
              </a>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
        </div>
      </div>
    </section>
  );
}

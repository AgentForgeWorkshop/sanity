import { BuiltWith } from "./sections/BuiltWith";
import { Agents } from "./sections/Agents";
import { Demo } from "./sections/Demo";
import { Hero } from "./sections/Hero";

export function App() {
  const run = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.dispatchEvent(new Event("sanity:demo"));
  };

  return (
    <>
      <a className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black" href="#demo">
        Skip to the demo
      </a>
      <main className="flex flex-col gap-16 md:gap-24">
        <Hero onRun={run} />
        <Agents />
        <Demo />
        <BuiltWith />
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-8 font-mono text-[11px] tracking-widest text-white/40 uppercase">
        Sanity · MIT
      </footer>
    </>
  );
}

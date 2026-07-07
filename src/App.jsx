/* Observability Atlas — opens the operations arc (Atlas 23 → 24 → 25). */

import { useEffect, useState } from 'react';
import Section01_ThreePillars from './sections/01-three-pillars.jsx';
import Section02_Logs         from './sections/02-logs.jsx';
import Section03_Metrics      from './sections/03-metrics.jsx';
import Section04_Traces       from './sections/04-traces.jsx';

const SECTIONS = [
  { id: 'three-pillars', label: '01 · Three Pillars', comp: Section01_ThreePillars },
  { id: 'logs',          label: '02 · Logs',          comp: Section02_Logs },
  { id: 'metrics',       label: '03 · Metrics',       comp: Section03_Metrics },
  { id: 'traces',        label: '04 · Traces',        comp: Section04_Traces },
];

function StickyHeader({ activeId }) {
  return (
    <div className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-50 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-baseline gap-4">
        <a href="#top" className="text-sky-300 text-[22px] leading-none"
          style={{ fontFamily: 'serif' }}>◉</a>
        <div className="flex-1">
          <div className="text-zinc-100 text-[14px] font-semibold leading-tight"
            style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Observability
          </div>
          <div className="text-zinc-500 text-[10.5px] tracking-[0.25em] uppercase"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            Atlas · B. Symbolic
          </div>
        </div>
        <a href="https://atlases.vercel.app"
          className="text-zinc-500 hover:text-sky-300 text-[11px] tracking-[0.2em] uppercase"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          ← all atlases
        </a>
      </div>

      <div className="border-t border-zinc-800/60 max-w-5xl mx-auto px-6 py-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
          {SECTIONS.map(s => {
            const isActive = activeId === s.id;
            return (
              <a key={s.id} href={`#${s.id}`}
                className={`px-3 py-1.5 border text-[11.5px] whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'border-sky-300 bg-sky-300/15 text-sky-200'
                    : 'border-zinc-700/80 text-zinc-400 hover:border-sky-300/50 hover:text-zinc-200'
                }`}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {s.label}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div id="top" className="border-b border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-sky-300 text-[11px] tracking-[0.4em] uppercase mb-4"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          atlas twenty-three · ◉
        </div>
        <h1 className="text-zinc-50 text-[42px] leading-[1.05] mb-4"
          style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700 }}>
          Observability
        </h1>
        <p className="text-zinc-400 text-[16px] max-w-2xl leading-relaxed"
          style={{ fontFamily: 'Manrope, sans-serif' }}>
          Opens the operations arc. The three pillars — logs, metrics, traces — and how to use
          them when production is on fire. What each one is good at, what none of them solve
          alone, and the cardinality budget that determines whether your observability stack
          costs more than the system it observes. The vocabulary every team needs and most do
          not have.
        </p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="border-t border-zinc-800 mt-20 py-10">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <div className="text-zinc-500 text-[11px] tracking-[0.3em] uppercase mb-2"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          end of atlas
        </div>
        <div className="text-zinc-600 text-[12px]">
          ◉ · Observability · B. Symbolic ·{' '}
          <a href="https://atlases.vercel.app" className="hover:text-sky-300">atlases.vercel.app</a>
        </div>
      </div>
    </div>
  );
}

function useActiveSection() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return activeId;
}

export default function App() {
  const activeId = useActiveSection();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <StickyHeader activeId={activeId} />
      <Hero />
      <div className="max-w-5xl mx-auto px-6">
        {SECTIONS.map(s => {
          const Comp = s.comp;
          return (
            <div key={s.id} id={s.id} className="scroll-mt-28">
              <Comp />
            </div>
          );
        })}
      </div>
      <Footer />
    </div>
  );
}

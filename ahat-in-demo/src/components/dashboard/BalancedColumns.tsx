import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface FlowCard {
  key: string;
  node: ReactNode;
  /** Order in the single phone column (Tailwind order-* class). */
  order: string;
  /** Prefer the wide column when both are about equal (e.g. long lists). */
  wide?: boolean;
  /** Always in the wide column (cards that get very tall when narrow). */
  wideOnly?: boolean;
}

const GAP = 24; // matches gap-6
const MIN_GAIN = 96; // only move cards when it clearly helps, so they don't jump back and forth

/**
 * Two dashboard columns (wide left, narrow right) that stay about the same height.
 * Fixed cards stay at the top of each column; the "flow" cards go to whichever column is shorter,
 * re-checked whenever anything changes size. On phones everything is one list, ordered by `order`.
 */
export function BalancedColumns({ left, right, flow }: { left: ReactNode; right: ReactNode; flow: FlowCard[] }) {
  const [side, setSide] = useState<Record<string, 'L' | 'R'>>({});
  const leftCol = useRef<HTMLDivElement>(null);
  const rightCol = useRef<HTMLDivElement>(null);
  const leftTop = useRef<HTMLDivElement>(null);
  const rightTop = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const history = useRef<{ sig: string; at: number }[]>([]);
  const retry = useRef<number>();
  const balanceRef = useRef<() => void>(() => {});

  const current = useCallback((c: FlowCard) => side[c.key] ?? (c.wide ? 'L' : 'R'), [side]);

  const balance = useCallback(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const l = leftCol.current, r = rightCol.current;
    if (!l || !r || !leftTop.current || !rightTop.current) return;
    // A card's height in each column: measured where it is now, estimated for the other column
    // (the right column is narrower, so text wraps more and cards get taller there).
    const visible = flow
      .map((c) => {
        const h = cards.current.get(c.key)?.offsetHeight ?? 0;
        const at = current(c);
        return { c, at, hL: at === 'L' ? h : h * 0.82, hR: at === 'R' ? h : h * 1.22 };
      })
      .filter((x) => x.hL > 0);
    // Try every split (at most 2^7) and keep the most even one; wide cards prefer the left column.
    const topL = leftTop.current.offsetHeight;
    const topR = rightTop.current.offsetHeight;
    let best = { cost: Infinity, mask: 0 };
    for (let mask = 0; mask < 1 << visible.length; mask++) {
      let L = topL, R = topR, penalty = 0;
      visible.forEach((x, i) => {
        if (mask & (1 << i)) {
          R += x.hR + GAP;
          if (x.c.wide) penalty += 60;
          if (x.c.wideOnly) penalty += 1e6;
        } else L += x.hL + GAP;
      });
      const cost = Math.abs(L - R) + penalty;
      if (cost < best.cost) best = { cost, mask };
    }
    const next: Record<string, 'L' | 'R'> = {};
    flow.forEach((c) => (next[c.key] = current(c)));
    visible.forEach((x, i) => (next[x.c.key] = best.mask & (1 << i) ? 'R' : 'L'));
    const changed = flow.some((c) => current(c) !== next[c.key]);
    if (!changed) return;
    const now = Math.abs(l.offsetHeight - r.offsetHeight);
    if (best.cost > now - MIN_GAIN) return;
    // Stop if this would undo a move made a moment ago (a flip-flop); later content changes may move it again.
    const sig = flow.map((c) => next[c.key]).join('');
    const t = Date.now();
    history.current = history.current.filter((h) => t - h.at < 1500);
    if (history.current.some((h) => h.sig === sig)) {
      // Held back to avoid flip-flopping; look again once the guard has expired.
      window.clearTimeout(retry.current);
      retry.current = window.setTimeout(() => balanceRef.current(), 1600);
      return;
    }
    history.current.push({ sig: flow.map(current).join(''), at: t });
    setSide(next);
  }, [flow, current]);

  // Re-check after every render, and whenever a column changes size.
  balanceRef.current = balance;
  useLayoutEffect(() => balance());
  useEffect(() => () => window.clearTimeout(retry.current), []);
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(balance);
    };
    const ro = new ResizeObserver(schedule);
    [leftTop.current, rightTop.current, ...cards.current.values()].forEach((el) => el && ro.observe(el));
    window.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [balance]);

  const card = (c: FlowCard) => (
    <div
      key={c.key}
      ref={(el) => {
        if (el) cards.current.set(c.key, el);
        else cards.current.delete(c.key);
      }}
      className={`${c.order} min-w-0 empty:hidden`}
      data-card={c.key}
    >
      {c.node}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start">
      <div ref={leftCol} className="contents lg:col-span-8 lg:flex lg:min-w-0 lg:flex-col lg:gap-6" data-column="left">
        <div ref={leftTop} className="contents lg:flex lg:flex-col lg:gap-6">{left}</div>
        {flow.filter((c) => current(c) === 'L').map(card)}
      </div>
      <div ref={rightCol} className="contents lg:col-span-4 lg:flex lg:min-w-0 lg:flex-col lg:gap-6" data-column="right">
        <div ref={rightTop} className="contents lg:flex lg:flex-col lg:gap-6">{right}</div>
        {flow.filter((c) => current(c) === 'R').map(card)}
      </div>
    </div>
  );
}

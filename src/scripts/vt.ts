// Tier 1 in-page motion: same-document View Transitions for filtering, sorting and
// the grid/list switch. Only cards in or near the viewport get a name, to keep the
// number of snapshots low on phones. Falls back to an instant change.
import type { Animate } from './library';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const near = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.bottom > -100 && r.top < innerHeight + 100 && r.width > 0;
};

let running: ViewTransition | null = null;

export const vtAnimate: Animate = (mutate, kind) => {
  if (!document.startViewTransition || reduced()) return mutate();
  running?.skipTransition();
  const named: HTMLElement[] = [];
  const name = () => {
    for (const card of document.querySelectorAll<HTMLElement>('.card:not([hidden])')) {
      if (!near(card) || card.style.viewTransitionName) continue;
      card.style.viewTransitionName = `card-${card.dataset.i}`;
      card.style.setProperty('view-transition-class', 'card');
      named.push(card);
    }
  };
  name();
  const t = document.startViewTransition(() => {
    mutate();
    name();
  });
  running = t;
  // A skipped transition (hidden tab, a newer one) rejects these; that's expected.
  t.ready.catch(() => {});
  t.updateCallbackDone.catch(() => {});
  const clear = () => {
    if (running !== t) return;
    running = null;
    for (const c of named) {
      c.style.viewTransitionName = '';
      c.style.removeProperty('view-transition-class');
    }
  };
  t.finished.then(clear, clear);
  void kind;
  return t;
};

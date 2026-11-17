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

const typing = () =>
  document.activeElement instanceof HTMLElement &&
  document.activeElement.matches(
    'input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable]',
  );

export const vtAnimate: Animate = (mutate, kind) => {
  // Never during search or while a text field has focus: some browsers (Safari)
  // move focus away during a view transition, which stopped typing after one key.
  if (!document.startViewTransition || reduced() || kind === 'search' || typing()) {
    return mutate();
  }
  const focused = document.activeElement as HTMLElement | null;
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
    // If the transition took focus away, give it back.
    if (focused && focused !== document.body && document.activeElement !== focused) {
      focused.focus({ preventScroll: true });
    }
    if (running !== t) return;
    running = null;
    for (const c of named) {
      c.style.viewTransitionName = '';
      c.style.removeProperty('view-transition-class');
    }
  };
  t.finished.then(clear, clear);
  return t;
};

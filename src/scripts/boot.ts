// Core script, loaded on every page (part of the ≤ 15 KB core budget).
// - mount()/unmount(): start and stop the scripts for whatever page is in the DOM.
//   The motion layer's router calls them on every page change.
// - Tier 1 motion (native View Transitions) for in-page changes.
// - Loads the Tier 2 motion layer (Swup + GSAP) when the browser is idle, unless the
//   visitor prefers reduced motion or has Save-Data on.
import { init as initLibrary, destroy as destroyLibrary, type Animate } from './library';
import { initNotdef } from './notdef';
import { vtAnimate } from './vt';

const FROM_KEY = 'rat:from-library';

// The library calls the *current* strategy, so Tier 2 can swap it in without a re-init.
let animate: Animate = vtAnimate;
export const setAnimate = (a: Animate) => (animate = a);

let cleanups: Array<() => void> = [];

export function mount() {
  unmount();
  const lib = document.querySelector<HTMLElement>('[data-lib]');
  if (lib) {
    initLibrary(lib, (mutate, kind) => animate(mutate, kind));
    cleanups.push(destroyLibrary);
  }
  const notdef = document.querySelector<HTMLElement>('[data-notdef]');
  if (notdef) cleanups.push(initNotdef(notdef));
  // Only a detail page reached from the library may send "←" back in history.
  if (!document.querySelector('[data-detail]')) safeSession('remove');
}

export function unmount() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
}

function safeSession(op: 'set' | 'get' | 'remove'): string | null {
  try {
    if (op === 'set') sessionStorage.setItem(FROM_KEY, '1');
    else if (op === 'remove') sessionStorage.removeItem(FROM_KEY);
    else return sessionStorage.getItem(FROM_KEY);
  } catch {
    /* storage blocked: "←" just follows its link */
  }
  return null;
}

/** True when a "←" link should go back in history (restoring filters and scroll). */
export const backGoesBack = (el: Element | null | undefined) =>
  !!el?.closest('[data-back]') && safeSession('get') === '1' && history.length > 1;

// Capture phase, so this runs before the router's own link handler: it records that
// a card was opened, and turns "←" into history.back() so filters and scroll come back.
document.addEventListener(
  'click',
  (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.card a')) safeSession('set');
    const back = t.closest('[data-back]');
    if (back && backGoesBack(back)) {
      e.preventDefault();
      e.stopImmediatePropagation(); // the router must not also navigate to "/"
      safeSession('remove');
      history.back();
    }
  },
  true,
);

mount();

// --- Tier 2 loader --------------------------------------------------------------
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  ?.saveData;
if (!reduced && !saveData) {
  const load = () =>
    import('./motion/index')
      .then((m) => m.start({ mount, unmount, setAnimate, backGoesBack }))
      .catch(() => {
        /* offline or blocked: Tier 1 keeps working */
      });
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2500 });
  else setTimeout(load, 1500);
}

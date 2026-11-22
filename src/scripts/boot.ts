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

// The footer's shelf of books takes seven different publication colours, picked at
// random on every page view (Footer.astro lists them in data-shelf).
function paintShelf() {
  const shelf = document.querySelector<SVGElement>('[data-shelf]');
  const pool = shelf?.dataset.shelf?.split(' ').filter(Boolean) ?? [];
  if (!shelf || !pool.length) return;
  // Fisher–Yates shuffle, then one colour per book; no repeats while there are enough.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  shelf.querySelectorAll('rect').forEach((r, i) => r.setAttribute('fill', pool[i % pool.length]!));
}

export function mount() {
  unmount();
  paintShelf();
  const lib = document.querySelector<HTMLElement>('[data-lib]');
  if (lib) {
    initLibrary(lib, (mutate, kind) => animate(mutate, kind));
    cleanups.push(destroyLibrary);
  }
  const notdef = document.querySelector<HTMLElement>('[data-notdef]');
  if (notdef) cleanups.push(initNotdef(notdef));
  // About page questions: animated open/close, loaded only there (not core budget).
  const faq = document.querySelector<HTMLElement>('[data-faq]');
  if (faq) {
    let stop: (() => void) | undefined;
    let gone = false;
    import('./faq')
      .then((m) => {
        if (!gone) stop = m.init(faq);
      })
      .catch(() => {
        /* offline: the questions still open and close natively */
      });
    cleanups.push(() => {
      gone = true;
      stop?.();
    });
  }
  // The submission form's script is loaded only where there's a form (not core budget).
  // Only a form in the page (/submit, /submit/fix/…): the panel's own form is wired
  // when the panel first opens (openPanel below).
  const form = document.querySelector<HTMLFormElement>('#main form[data-submit]');
  if (form) {
    let stop: (() => void) | undefined;
    let gone = false;
    import('./submit')
      .then((m) => {
        if (!gone) stop = m.init(form);
      })
      .catch(() => {
        /* offline: the form still posts natively */
      });
    cleanups.push(() => {
      gone = true;
      stop?.();
    });
  }
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
    // "+" opens the submission panel (SubmitPanel.astro) instead of going to /submit;
    // on the /submit page itself, the form is already there.
    const opener = t.closest('[data-submit-open]');
    const onSubmitPage = /^\/submit(\.html)?\/?$/.test(location.pathname);
    if (opener && document.querySelector('[data-submit-panel]') && !onSubmitPage) {
      e.preventDefault();
      e.stopImmediatePropagation(); // the router must not navigate to /submit
      import('./submit')
        .then((m) => m.openPanel() || location.assign('/submit'))
        .catch(() => location.assign('/submit'));
      return;
    }
    if (t.closest('[data-back-to-top]')) {
      e.preventDefault();
      e.stopImmediatePropagation(); // the router would jump to #top
      scrollToTop();
      return;
    }
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

// "Back to top": a gentle scroll (ease-in-out, longer for longer pages) that stops
// as soon as the visitor scrolls themselves. Instant under reduced motion. Focus
// moves to the logo, so keyboard users land at the top too.
function scrollToTop() {
  const from = window.scrollY;
  const done = () =>
    document.querySelector<HTMLElement>('.site-header .brand')?.focus({ preventScroll: true });
  if (from === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, 0);
    return done();
  }
  const duration = Math.min(1600, 700 + from / 8);
  const start = performance.now();
  let stopped = false;
  const stop = () => (stopped = true);
  const opts = { once: true, passive: true } as const;
  window.addEventListener('wheel', stop, opts);
  window.addEventListener('touchstart', stop, opts);
  window.addEventListener('keydown', stop, { once: true });
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const step = (now: number) => {
    if (stopped) return;
    const p = Math.min(1, (now - start) / duration);
    window.scrollTo(0, Math.round(from * (1 - ease(p))));
    if (p < 1) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

mount();

// The homepage's intro animation (global.css, "Intro") runs once, on a fresh load:
// drop its class when it's over, so later page changes and filtering don't replay it.
if (document.documentElement.classList.contains('is-intro')) {
  setTimeout(() => document.documentElement.classList.remove('is-intro'), 2400);
}

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

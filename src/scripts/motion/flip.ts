// Tier 2 in-page motion: GSAP Flip for filtering, sorting and grid ↔ list.
// Interruptible: getState() on a running flip records in-flight positions.
// Only cards in or near the viewport (max MAX) are measured and animated; the rest
// snap (measuring all cards cost a 100 ms+ frame in the spike).
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import type { Animate } from '../library';

gsap.registerPlugin(Flip);

const MAX = 40;
const MARGIN = 200;
let current: gsap.core.Timeline | null = null;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const near = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.bottom > -MARGIN && r.top < innerHeight + MARGIN && r.width > 0;
};
const nearCards = () =>
  [...document.querySelectorAll<HTMLElement>('[data-grid] .card:not([hidden])')]
    .filter(near)
    .slice(0, MAX);
const withTiles = (cards: HTMLElement[]) =>
  cards.flatMap((c) => [c, c.querySelector<HTMLElement>('.tile')!]);

export const flipAnimate: Animate = (mutate, kind) => {
  const grid = document.querySelector<HTMLElement>('[data-grid]');
  if (reduced() || !grid) return mutate();
  const isView = kind === 'view';
  // Pause the scroll-driven tile reveal: a CSS animation would override Flip's transforms.
  grid.classList.add('is-flipping');
  const before = nearCards();
  const state = Flip.getState(isView ? withTiles(before) : before);
  mutate();
  current?.kill();
  const after = nearCards();
  const cards = [...new Set([...before, ...after])].slice(0, MAX);
  current = Flip.from(state, {
    targets: isView ? withTiles(cards) : cards,
    duration: isView ? 0.65 : 0.6,
    ease: 'power3.inOut',
    nested: isView,
    absoluteOnLeave: true,
    stagger: { amount: isView ? 0.15 : 0.1, from: 'start' },
    onEnter: (els) =>
      gsap.fromTo(
        els,
        { opacity: 0, scale: 0.85 },
        { opacity: 1, scale: 1, duration: 0.45, delay: 0.2, ease: 'power2.out' },
      ),
    onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.3, ease: 'power2.in' }),
    onComplete: () => grid.classList.remove('is-flipping'),
    onInterrupt: () => grid.classList.remove('is-flipping'),
  });
  if (isView) {
    // Text reflows instantly into the new layout; fade it in so it doesn't pop.
    gsap.fromTo(
      after.map((c) => c.querySelector('.caption')),
      { opacity: 0 },
      { opacity: 1, duration: 0.35, delay: 0.3, clearProps: 'opacity' },
    );
  }
  return current;
};

// Tier 2 motion layer (ADR-012), loaded at idle by boot.ts unless the visitor prefers
// reduced motion or has Save-Data on. Swup routes between pages and keeps the header
// and footer; GSAP choreographs the live DOM of both pages, so transitions work in
// every browser and can be interrupted.
import Swup from 'swup';
import SwupJsPlugin from '@swup/js-plugin';
import SwupPreloadPlugin from '@swup/preload-plugin';
import SwupScrollPlugin from '@swup/scroll-plugin';
import SwupHeadPlugin from '@swup/head-plugin';
import { gsap } from 'gsap';
import type { Animate } from '../library';
import { flipAnimate } from './flip';

type Core = {
  mount(): void;
  unmount(): void;
  setAnimate(a: Animate): void;
  backGoesBack(el?: Element | null): boolean;
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const path = (url: string) => new URL(url, location.origin).pathname;
const isDetail = (url: string) => /^\/publications\/[^/]+$/.test(path(url));
const isLibrary = (url: string) => path(url) === '/';
const slugOf = (url: string) => path(url).split('/').pop()!;
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
const inView = (el: Element, margin = 0) => {
  const r = el.getBoundingClientRect();
  return r.bottom > -margin && r.top < innerHeight + margin && r.width > 0;
};
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
/** The rectangle the image actually occupies (covers use object-fit: contain). */
function displayedRect(img: HTMLImageElement): DOMRect {
  const r = img.getBoundingClientRect();
  const { naturalWidth: nw, naturalHeight: nh } = img;
  if (!nw || !nh || getComputedStyle(img).objectFit !== 'contain') return r;
  const s = Math.min(r.width / nw, r.height / nh);
  const w = nw * s;
  const h = nh * s;
  return new DOMRect(r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h);
}

// The signature transition (card <-> detail) uses two fixed layers outside <main>,
// so they survive the page swap: a "block" in the publication's colour whose visible
// box morphs between the grid tile and the detail page's coloured block (clip-path
// on a viewport-sized layer: no layout animation), and a copy of the cover that flies
// on top of it. The cover is never masked and always sits on its colour.
const RADIUS = 6;
function clipFor(r: DOMRect) {
  const top = Math.max(r.top, 0);
  const left = Math.max(r.left, 0);
  const right = Math.max(innerWidth - r.right, 0);
  const bottom = Math.max(innerHeight - r.bottom, 0);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${RADIUS}px)`;
}
function makeBlock(color: string, r: DOMRect): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '39',
    pointerEvents: 'none',
    background: color,
    clipPath: clipFor(r),
    willChange: 'clip-path',
  });
  document.body.append(el);
  return el;
}

type Ghost = { el: HTMLImageElement; rect: DOMRect };
/** A copy of a cover that flies between the two pages. It lives inside the colour
 *  block (viewport-sized, so its coordinates are the viewport's), whose clip-path
 *  frames it: the cover never shows outside its coloured background. */
function makeGhost(img: HTMLImageElement, block: HTMLElement): Ghost {
  const rect = displayedRect(img);
  const el = document.createElement('img');
  el.src = img.currentSrc || img.src;
  el.alt = '';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    willChange: 'transform',
  });
  block.append(el);
  return { el, rect };
}
const flyTo = (g: Ghost, target: DOMRect) => ({
  x: target.left - g.rect.left,
  y: target.top - g.rect.top,
  scale: target.width / g.rect.width,
});
/** Stagger by distance from a point: a ripple outwards from the clicked card. */
const ripple = (from: DOMRect, k = 0.0004) => {
  const c = center(from);
  return (_: number, el: Element) => {
    const p = center(el.getBoundingClientRect());
    return Math.hypot(p.x - c.x, p.y - c.y) * k;
  };
};
const imageReady = (img: HTMLImageElement, timeout: number) =>
  img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, timeout);
      });

// Gentle, unhurried motion (matches the CSS tokens: soft ease-out, no overshoot).
const MORPH = { duration: 1, ease: 'power3.inOut' };
const FADE_IN = { duration: 0.7, ease: 'power3.out' };
const FADE_OUT = { duration: 0.4, ease: 'power2.inOut' };
// Going back to the library plays 30% faster (time scale 1 / 0.7).
const BACK_SPEED = 1 / 0.7;
const timeline = (back: boolean) => gsap.timeline().timeScale(back ? BACK_SPEED : 1);

export function start(core: Core) {
  core.setAnimate(flipAnimate);

  let ghost: Ghost | null = null;
  let block: HTMLElement | null = null;
  let tl: gsap.core.Timeline | null = null;
  let hidden: HTMLElement[] = [];
  let mode: 'toDetail' | 'toLibrary' | 'other' = 'other';
  let slug = '';
  // Scroll position of each page when it was left, so the library can be restored
  // *before* the reverse transition measures where the card is.
  const scrollMemory = new Map<string, number>();

  const hide = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.style.opacity = '0';
    hidden.push(el);
  };
  const TOUCHED =
    '#main, [data-controls], [data-lib-tools], [data-header-back], .card, .card .tile, [data-detail], [data-detail] [data-hero], [data-detail] .head, [data-detail] .subtitle, [data-detail] .panel';
  function cleanup() {
    tl?.kill();
    tl = null;
    ghost?.el.remove();
    ghost = null;
    block?.remove();
    block = null;
    hidden.forEach((h) => (h.style.opacity = ''));
    hidden = [];
    gsap.set($$(TOUCHED), { clearProps: 'opacity,transform' });
  }
  const chrome = () => [$('[data-controls]'), $('[data-lib-tools]'), $('[data-header-back]')];
  // The header buttons one by one (List/Search/Filter on the library, "Home" on a
  // publication) plus the library controls, for their entrance.
  const chromeItems = () =>
    [
      ...$$('[data-lib-tools] > :not(.blank)'),
      ...$$('[data-header-back] > *'),
      $('[data-controls]'),
    ].filter(Boolean) as HTMLElement[];
  const chromeIn = (t: gsap.core.Timeline, at: number) =>
    t.fromTo(
      chromeItems(),
      { opacity: 0, x: 16 },
      { opacity: 1, x: 0, ...FADE_IN, stagger: 0.08 },
      at,
    );

  const js = new SwupJsPlugin({
    animations: [
      {
        from: '(.*)',
        to: '(.*)',
        out: async (
          _done: () => void,
          { visit }: { visit: { from: { url: string }; to: { url: string } } },
        ) => {
          cleanup();
          const from = visit.from.url;
          const to = visit.to.url;
          scrollMemory.set(from, scrollY);
          mode =
            isLibrary(from) && isDetail(to)
              ? 'toDetail'
              : isDetail(from) && isLibrary(to)
                ? 'toLibrary'
                : 'other';
          if (reduced()) return;
          tl = timeline(mode === 'toLibrary');

          if (mode === 'toDetail') {
            // The tile's colour and cover lift out of the page; the rest fades away.
            slug = slugOf(to);
            const card = $(`.card[data-id="${CSS.escape(slug)}"]`);
            const tile = card?.querySelector<HTMLElement>('.tile');
            const img = tile?.querySelector<HTMLImageElement>('img');
            if (card && tile && img?.naturalWidth && inView(tile)) {
              block = makeBlock(
                getComputedStyle(tile).backgroundColor,
                tile.getBoundingClientRect(),
              );
              ghost = makeGhost(img, block);
              hide(tile);
              const others = $$('.card:not([hidden])').filter((c) => c !== card && inView(c));
              tl.to(others, { opacity: 0, y: 12, ...FADE_OUT, stagger: ripple(ghost.rect) }, 0).to(
                [...chrome(), card.querySelector('.caption')].filter(Boolean),
                { opacity: 0, ...FADE_OUT },
                0,
              );
            } else {
              tl.to('#main', { opacity: 0, y: -8, ...FADE_OUT });
            }
          } else if (mode === 'toLibrary') {
            // Text and details fade first; then the coloured block and its cover are
            // taken over by the fixed layers, so nothing changes on screen.
            slug = slugOf(from);
            const hero = $('[data-detail] [data-hero]');
            const img = hero?.querySelector<HTMLImageElement>('.hero-cover img');
            tl.to(
              [
                ...$$('[data-detail] .head, [data-detail] .subtitle, [data-detail] .panel'),
                ...chrome(),
              ].filter(Boolean),
              { opacity: 0, y: 8, ...FADE_OUT },
            );
            await tl;
            if (hero && img?.naturalWidth && inView(img)) {
              block = makeBlock(
                getComputedStyle(hero).backgroundColor,
                hero.getBoundingClientRect(),
              );
              ghost = makeGhost(img, block);
              hide(hero);
            }
            tl = timeline(true);
            if (!block) tl.to('#main', { opacity: 0, ...FADE_OUT });
          } else {
            tl.to('#main', { opacity: 0, y: -8, ...FADE_OUT });
          }
          await tl;
        },
        in: async () => {
          if (reduced()) return;
          tl = timeline(mode === 'toLibrary');

          if (mode === 'toDetail' && ghost && block) {
            const g = ghost;
            const hero = $('[data-detail] [data-hero]');
            const heroImg = $<HTMLImageElement>('[data-detail] .hero-cover img');
            const target = heroImg?.getBoundingClientRect();
            if (hero)
              tl.to(block, { clipPath: clipFor(hero.getBoundingClientRect()), ...MORPH }, 0);
            if (target) tl.to(g.el, { ...flyTo(g, target), ...MORPH }, 0);
            await tl;
            // The real block takes over (same place, same colour) once its cover image
            // has loaded, so the copy is never swapped for an empty frame; then the
            // title, the details and the header buttons settle in.
            if (heroImg) await imageReady(heroImg, 1500);
            for (const el of [hero, heroImg]) if (el) el.style.opacity = '';
            hidden = hidden.filter((h) => h !== hero && h !== heroImg);
            block.remove();
            block = null;
            ghost = null;
            tl = gsap.timeline();
            tl.fromTo(
              $$('[data-detail] .head, [data-detail] .subtitle'),
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, ...FADE_IN, stagger: 0.06 },
              0,
            ).fromTo(
              $$('[data-detail] .panel'),
              { opacity: 0, y: 24 },
              { opacity: 1, y: 0, ...FADE_IN },
              0.1,
            );
            chromeIn(tl, 0.1);
            await tl;
          } else if (mode === 'toLibrary' && ghost && block) {
            const g = ghost;
            const b = block;
            const card = $(`.card[data-id="${CSS.escape(slug)}"]`);
            const tile = card?.querySelector<HTMLElement>('.tile');
            const img = tile?.querySelector<HTMLImageElement>('img');
            if (card && tile && img && !card.hidden) {
              if (!inView(tile, -40)) card.scrollIntoView({ block: 'center' });
              card.style.opacity = '';
              hide(tile);
              const visible = $$('.card:not([hidden])').filter((c) => c !== card && inView(c));
              tl.to(b, { clipPath: clipFor(tile.getBoundingClientRect()), ...MORPH }, 0)
                .to(g.el, { ...flyTo(g, displayedRect(img)), ...MORPH }, 0)
                .fromTo(
                  visible,
                  { opacity: 0, y: 12 },
                  { opacity: 1, y: 0, ...FADE_IN, stagger: ripple(tile.getBoundingClientRect()) },
                  0.35,
                );
              // The List/Search/Filter buttons come back one by one.
              chromeIn(tl, 0.45);
            } else {
              tl.to(b, { opacity: 0, ...FADE_OUT }).to($$('.card'), { opacity: 1, ...FADE_IN });
              chromeIn(tl, 0.2);
            }
            await tl;
          } else {
            tl.fromTo('#main', { opacity: 0, y: 12 }, { opacity: 1, y: 0, ...FADE_IN });
            await tl;
          }
          cleanup();
        },
      },
    ],
  });

  const swup: Swup = new Swup({
    // The header persists; only its slots (the detail page's "Home", the homepage's
    // buttons) are swapped.
    containers: ['#main', '[data-header-back]', '[data-header-tools]'],
    animateHistoryBrowsing: true,
    // Links that must load normally: the CMS, machine files, and "←" when it goes
    // back in history (boot.ts handles that click; otherwise Swup would push "/"
    // first and history.back() would undo it: the double-click bug from the spike).
    ignoreVisit: (url, { el } = {}) =>
      /^\/(admin|search\.json|sitemap\.xml|robots\.txt)/.test(path(url)) ||
      core.backGoesBack(el) ||
      !!el?.closest('[data-no-swup]'),
    // Back/forward between filter states of the same page belongs to the library
    // (it pushes its own history entries); Swup only handles page changes.
    skipPopStateHandling: () => location.pathname === path(swup.location.url),
    plugins: [
      js,
      new SwupPreloadPlugin({ preloadHoveredLinks: true }),
      new SwupScrollPlugin({
        animateScroll: { betweenPages: false, samePageWithHash: false, samePage: false },
      }),
      new SwupHeadPlugin({ awaitAssets: true }),
    ],
  });

  swup.hooks.before('content:replace', () => core.unmount());

  // For the signature transitions we set the scroll ourselves (synchronously, before
  // measuring); the scroll plugin would only scroll one frame later.
  const signature = () => (mode === 'toDetail' || mode === 'toLibrary') && !!block && !reduced();
  swup.hooks.before('content:scroll', (visit) => {
    if (signature()) visit.scroll.reset = false;
  });

  // New content is in the DOM, before its first paint: start its scripts, set the
  // scroll, pre-hide what will animate in (the fixed layers cover the rest, so the
  // page never flashes its background).
  swup.hooks.on('content:replace', (visit) => {
    core.mount();
    if (signature()) {
      window.scrollTo({
        top: mode === 'toLibrary' ? (scrollMemory.get(visit.to.url) ?? 0) : 0,
        behavior: 'instant',
      });
    }
    if (reduced() || !block) return;
    if (mode === 'toDetail') {
      hide($('[data-detail] [data-hero]'));
      hide($('[data-detail] .hero-cover img'));
      gsap.set(
        [
          ...$$('[data-detail] .head, [data-detail] .subtitle, [data-detail] .panel'),
          ...chromeItems(),
        ],
        { opacity: 0 },
      );
    }
    if (mode === 'toLibrary') {
      gsap.set([...$$('.card'), ...chromeItems()], { opacity: 0 });
    }
  });

  // Accessibility: move focus to the new content and announce the page.
  swup.hooks.on('page:view', () => {
    const announcer = $('[data-announcer]');
    if (announcer) announcer.textContent = document.title;
    // The header persists across pages: keep its "current page" marker in sync.
    for (const a of $$<HTMLAnchorElement>('.site-header nav a')) {
      if (location.pathname.startsWith(a.pathname)) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    const back =
      mode === 'toLibrary' ? $<HTMLElement>(`.card[data-id="${CSS.escape(slug)}"] a`) : null;
    const target = back ?? $<HTMLElement>('#main h1') ?? $<HTMLElement>('#main');
    if (target && target !== back && !target.hasAttribute('tabindex'))
      target.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
  });
  swup.hooks.on('visit:abort', cleanup);
}

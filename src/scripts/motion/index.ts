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
import { SplitText } from 'gsap/SplitText';
import type { Animate } from '../library';
import { flipAnimate } from './flip';

gsap.registerPlugin(SplitText);

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
/** Distance from a point to the farthest corner of a box (for clip-path circles). */
const farthest = (x: number, y: number, w: number, h: number) =>
  Math.max(
    ...[
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ].map(([a, b]) => Math.hypot(a! - x, b! - y)),
  );

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

type Ghost = { el: HTMLImageElement; rect: DOMRect };
/** A fixed copy of a cover that flies between the two pages (lives outside #main). */
function makeGhost(img: HTMLImageElement): Ghost {
  const rect = displayedRect(img);
  const el = document.createElement('img');
  el.src = img.currentSrc || img.src;
  el.alt = '';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '40',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    willChange: 'transform',
    filter: 'drop-shadow(0 14px 28px rgb(0 0 0 / 0.35))',
  });
  document.body.append(el);
  return { el, rect };
}
const flyTo = (g: Ghost, target: DOMRect) => ({
  x: target.left - g.rect.left,
  y: target.top - g.rect.top,
  scale: target.width / g.rect.width,
});
/** Stagger by distance from a point: a ripple outwards from the clicked card. */
const ripple = (from: DOMRect, k = 0.00045) => {
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

export function start(core: Core) {
  core.setAnimate(flipAnimate);

  let ghost: Ghost | null = null;
  let overlay: HTMLElement | null = null;
  let tl: gsap.core.Timeline | null = null;
  let hidden: HTMLElement[] = [];
  let mode: 'toDetail' | 'toLibrary' | 'other' = 'other';
  let slug = '';
  // The detail sheet's colour and visible box, captured while its styles still apply
  // (the head plugin swaps page stylesheets right before the content is replaced).
  let sheetBox: { rect: DOMRect; color: string } | null = null;
  // Scroll position of each page when it was left, so the library can be restored
  // *before* the reverse transition measures where the card is.
  const scrollMemory = new Map<string, number>();

  const hide = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    el.style.opacity = '0';
    hidden.push(el);
  };
  const TOUCHED =
    '#main, .intro, [data-controls], .card, .card .caption, .card .tile, [data-detail], [data-detail] .head, [data-detail] .panel, [data-detail] .subtitle, [data-detail] .title';
  function cleanup() {
    tl?.kill();
    tl = null;
    ghost?.el.remove();
    ghost = null;
    overlay?.remove();
    overlay = null;
    hidden.forEach((h) => (h.style.opacity = ''));
    hidden = [];
    gsap.set($$(TOUCHED), { clearProps: 'opacity,transform,clipPath' });
  }

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
          tl = gsap.timeline();

          if (mode === 'toDetail') {
            slug = slugOf(to);
            const card = $(`.card[data-id="${CSS.escape(slug)}"]`);
            const img = card?.querySelector<HTMLImageElement>('.tile img');
            if (card && img?.naturalWidth && inView(img)) {
              ghost = makeGhost(img);
              hide(img);
              const others = $$('.card:not([hidden])').filter((c) => c !== card && inView(c));
              tl.to(
                others,
                {
                  opacity: 0,
                  y: 24,
                  scale: 0.96,
                  duration: 0.32,
                  ease: 'power2.in',
                  stagger: ripple(ghost.rect),
                },
                0,
              )
                .to(
                  [$('.intro'), $('[data-controls]'), card.querySelector('.caption')].filter(
                    Boolean,
                  ),
                  { opacity: 0, y: -10, duration: 0.25, ease: 'power2.in' },
                  0,
                )
                .to(ghost.el, { scale: 1.04, y: -6, duration: 0.3, ease: 'power2.out' }, 0);
            } else {
              tl.to('#main', { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in' });
            }
          } else if (mode === 'toLibrary') {
            slug = slugOf(from);
            const sheet = $('[data-detail]');
            sheetBox = sheet
              ? {
                  rect: sheet.getBoundingClientRect(),
                  color: getComputedStyle(sheet).backgroundColor,
                }
              : null;
            const img = $<HTMLImageElement>('[data-detail] .hero-cover img');
            if (img?.naturalWidth && inView(img)) {
              ghost = makeGhost(img);
              hide(img);
            }
            tl.to($$('[data-detail] .panel, [data-detail] .head'), {
              opacity: 0,
              y: 12,
              duration: 0.22,
              stagger: 0.03,
              ease: 'power2.in',
            });
          } else {
            tl.to('#main', { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in' });
          }
          await tl;
        },
        in: async () => {
          if (reduced()) return;
          tl = gsap.timeline();

          if (mode === 'toDetail' && ghost) {
            const g = ghost;
            const sheet = $('[data-detail]')!;
            const hero = $<HTMLImageElement>('[data-detail] .hero-cover img');
            const title = $('[data-detail] .title');
            const target = hero?.getBoundingClientRect();
            const sr = sheet.getBoundingClientRect();
            const gc = center(g.el.getBoundingClientRect());
            const cx = gc.x - sr.left;
            const cy = gc.y - sr.top;
            const R = farthest(cx, cy, sr.width, Math.min(sr.height, innerHeight - sr.top + 200));
            const split = title ? SplitText.create(title, { type: 'lines', mask: 'lines' }) : null;
            if (title) gsap.set(title, { opacity: 1 });
            tl.fromTo(
              sheet,
              { clipPath: `circle(0px at ${cx}px ${cy}px)` },
              {
                clipPath: `circle(${R}px at ${cx}px ${cy}px)`,
                duration: 0.8,
                ease: 'power3.inOut',
              },
              0,
            );
            if (target) tl.to(g.el, { ...flyTo(g, target), duration: 0.85, ease: 'expo.inOut' }, 0);
            if (split)
              tl.from(
                split.lines,
                { yPercent: 110, duration: 0.8, ease: 'expo.out', stagger: 0.07 },
                0.4,
              );
            tl.fromTo(
              $$('[data-detail] .panel, [data-detail] .subtitle, [data-detail] .back'),
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' },
              0.5,
            );
            await tl;
            split?.revert();
            // Land: swap the low-res ghost for the hero image once it has loaded.
            if (hero) {
              await imageReady(hero, 1200);
              hero.style.opacity = '';
              hidden = hidden.filter((h) => h !== hero);
              await gsap.to(g.el, { opacity: 0, duration: 0.2 });
            }
          } else if (mode === 'toLibrary' && ghost && overlay) {
            const g = ghost;
            const ov = overlay;
            const card = $(`.card[data-id="${CSS.escape(slug)}"]`);
            const img = card?.querySelector<HTMLImageElement>('.tile img');
            if (card && img && !card.hidden) {
              if (!inView(card, -40)) card.scrollIntoView({ block: 'center' });
              const cr = displayedRect(img);
              hide(img);
              const or = ov.getBoundingClientRect();
              const tc = center(card.querySelector('.tile')!.getBoundingClientRect());
              const ox = tc.x - or.left;
              const oy = tc.y - or.top;
              const R = farthest(ox, oy, or.width, or.height);
              const visible = $$('.card:not([hidden])').filter((c) => c !== card && inView(c));
              tl.fromTo(
                ov,
                { clipPath: `circle(${R}px at ${ox}px ${oy}px)` },
                { clipPath: `circle(0px at ${ox}px ${oy}px)`, duration: 0.7, ease: 'power3.inOut' },
                0,
              )
                .to(g.el, { ...flyTo(g, cr), duration: 0.75, ease: 'expo.inOut' }, 0)
                .fromTo(
                  visible,
                  { opacity: 0, y: 24, scale: 0.96 },
                  {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.5,
                    ease: 'power2.out',
                    stagger: ripple(cr),
                  },
                  0.2,
                )
                .fromTo(
                  [$('.intro'), $('[data-controls]'), card, card.querySelector('.caption')].filter(
                    Boolean,
                  ),
                  { opacity: 0 },
                  { opacity: 1, duration: 0.4 },
                  0.35,
                );
            } else {
              tl.to([g.el, ov, ...$$('.card, .intro, [data-controls]')], {
                opacity: 0,
                duration: 0.3,
              }).set($$('.card, .intro, [data-controls]'), { opacity: 1 });
            }
            await tl;
          } else {
            tl.fromTo(
              '#main',
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
            );
            await tl;
          }
          cleanup();
        },
      },
    ],
  });

  const swup: Swup = new Swup({
    containers: ['#main'],
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

  // Leaving a detail page: keep its colour as an overlay that will shrink into the card.
  swup.hooks.before('content:replace', () => {
    core.unmount();
    if (mode === 'toLibrary' && ghost && sheetBox && !reduced()) {
      const r = sheetBox.rect;
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, innerHeight);
      overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        left: `${r.left}px`,
        top: `${top}px`,
        width: `${r.width}px`,
        height: `${Math.max(bottom - top, 0)}px`,
        zIndex: '35',
        pointerEvents: 'none',
        background: sheetBox.color,
      });
      document.body.append(overlay);
    }
    sheetBox = null;
  });

  // For the signature transitions we set the scroll ourselves (synchronously, before
  // measuring); the scroll plugin would only scroll one frame later.
  const signature = () => (mode === 'toDetail' || mode === 'toLibrary') && !!ghost && !reduced();
  swup.hooks.before('content:scroll', (visit) => {
    if (signature()) visit.scroll.reset = false;
  });

  // New content is in the DOM, before its first paint: start its scripts, set the
  // scroll, pre-hide what will animate in.
  swup.hooks.on('content:replace', (visit) => {
    core.mount();
    if (signature()) {
      window.scrollTo({
        top: mode === 'toLibrary' ? (scrollMemory.get(visit.to.url) ?? 0) : 0,
        behavior: 'instant',
      });
    }
    if (reduced()) return;
    if (mode === 'toDetail' && ghost) {
      hide($('[data-detail] .hero-cover img'));
      gsap.set($('[data-detail]'), { clipPath: 'circle(0px at 50% 50%)' });
      gsap.set(
        $$(
          '[data-detail] .panel, [data-detail] .subtitle, [data-detail] .back, [data-detail] .title',
        ),
        {
          opacity: 0,
        },
      );
    }
    if (mode === 'toLibrary' && ghost) {
      gsap.set([...$$('.card'), $('.intro'), $('[data-controls]')].filter(Boolean), { opacity: 0 });
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

  enableSheetDrag();
}

/** Mobile filter sheet: drag the handle down to dismiss it, following the finger. */
function enableSheetDrag() {
  let panel: HTMLDialogElement | null = null;
  let startY = 0;
  let dy = 0;
  let t0 = 0;
  document.addEventListener('pointerdown', (e) => {
    const head = (e.target as Element).closest<HTMLElement>('[data-panel] .panel-head');
    const p = head?.closest('dialog');
    if (!head || !p?.matches(':modal') || (e.target as Element).closest('button')) return;
    panel = p;
    startY = e.clientY;
    dy = 0;
    t0 = performance.now();
    head.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', (e) => {
    if (!panel) return;
    dy = Math.max(0, e.clientY - startY);
    gsap.set(panel, { y: dy });
  });
  const end = () => {
    if (!panel) return;
    const p = panel;
    panel = null;
    const velocity = dy / Math.max(performance.now() - t0, 1);
    if (dy > 120 || (dy > 30 && velocity > 0.6)) {
      gsap.to(p, {
        y: p.offsetHeight,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          p.close();
          gsap.set(p, { clearProps: 'transform' });
        },
      });
    } else {
      gsap.to(p, { y: 0, duration: 0.35, ease: 'back.out(2)', clearProps: 'transform' });
    }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}

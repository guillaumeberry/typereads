// Detail page, editions and issues (ADR-014, Figma "Detail desktop page"): the
// carousel of covers. The strip scrolls and snaps natively (works without JS); this
// adds the ← caption → row: the buttons move one slide, the caption names the slide
// in view, and an arrow disappears at either end. Loaded by boot.ts only where there
// is a carousel; smooth scrolling is skipped under reduced motion.
export function init(root: HTMLElement): () => void {
  const strip = root.querySelector<HTMLElement>('[data-strip]');
  const nav = root.querySelector<HTMLElement>('[data-gallery-nav]');
  const prev = root.querySelector<HTMLButtonElement>('[data-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-next]');
  const caption = root.querySelector<HTMLElement>('[data-gallery-caption]');
  const slides = strip ? [...strip.querySelectorAll<HTMLElement>(':scope > li')] : [];
  if (!strip || !nav || !prev || !next || !caption || slides.length < 2) return () => {};

  // Distance between two slides (slide width + gap), measured, so CSS stays the truth.
  const step = () => slides[1]!.offsetLeft - slides[0]!.offsetLeft || strip.clientWidth;
  const current = () =>
    Math.min(slides.length - 1, Math.max(0, Math.round(strip.scrollLeft / step())));

  let shown = -1;
  const update = () => {
    const i = current();
    if (i === shown) return;
    shown = i;
    caption.textContent = slides[i]!.dataset.caption ?? '';
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
  };
  const go = (delta: number) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({ left: (current() + delta) * step(), behavior: reduced ? 'auto' : 'smooth' });
  };

  let frame = 0;
  const onScroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  const onPrev = () => go(-1);
  const onNext = () => go(1);

  nav.hidden = false;
  update();
  strip.addEventListener('scroll', onScroll, { passive: true });
  prev.addEventListener('click', onPrev);
  next.addEventListener('click', onNext);
  return () => {
    cancelAnimationFrame(frame);
    strip.removeEventListener('scroll', onScroll);
    prev.removeEventListener('click', onPrev);
    next.removeEventListener('click', onNext);
  };
}

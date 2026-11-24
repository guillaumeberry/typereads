// Detail page, editions and issues (ADR-014): a thumbnail shows its cover in the main
// spot. Without JS the thumbnails link to the full images. Loaded by boot.ts only
// where there are thumbnails; a View Transition crossfades the swap when available
// (skipped under reduced motion).
export function init(root: HTMLElement): () => void {
  const slots = [...root.querySelectorAll<HTMLElement>('[data-cover]')];
  const thumbs = [...document.querySelectorAll<HTMLAnchorElement>('[data-thumb]')];
  if (slots.length < 2 || !thumbs.length) return () => {};

  const show = (i: number) => {
    slots.forEach((s) => (s.hidden = s.dataset.cover !== String(i)));
    thumbs.forEach((t) =>
      t.dataset.thumb === String(i)
        ? t.setAttribute('aria-current', 'true')
        : t.removeAttribute('aria-current'),
    );
  };

  const onClick = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const thumb = (e.target as Element).closest<HTMLAnchorElement>('[data-thumb]');
    if (!thumb) return;
    e.preventDefault();
    e.stopPropagation(); // not a page change for the router
    const i = Number(thumb.dataset.thumb);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && 'startViewTransition' in document) document.startViewTransition(() => show(i));
    else show(i);
  };

  const list = thumbs[0]!.closest('ul') ?? document;
  list.addEventListener('click', onClick as EventListener);
  return () => list.removeEventListener('click', onClick as EventListener);
}

// About page questions (Figma "Accordion"): native <details>, so they work without JS;
// with it, opening and closing are animated: the answer's height eases open or shut
// (the questions below glide along) while its text fades. Loaded by boot.ts only where
// [data-faq] exists; skipped under reduced motion (plain open/close).
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION = 450;

export function init(root: HTMLElement): () => void {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const running = new WeakMap<HTMLDetailsElement, Animation>();
  const cleanups: Array<() => void> = [];

  for (const details of root.querySelectorAll<HTMLDetailsElement>('details')) {
    const summary = details.querySelector('summary');
    const answer = details.querySelector<HTMLElement>('.answer');
    if (!summary || !answer) continue;

    const onClick = (e: Event) => {
      if (reduced()) return; // native toggle
      e.preventDefault();
      const closing = details.open && !details.dataset.closing;
      running.get(details)?.cancel();
      const from = answer.getBoundingClientRect().height;
      if (closing) {
        details.dataset.closing = 'true';
        details.classList.add('is-closing');
      } else {
        delete details.dataset.closing;
        details.classList.remove('is-closing');
        details.open = true;
      }
      const to = closing ? 0 : answer.scrollHeight;
      const anim = answer.animate(
        [
          { height: `${closing ? from : 0}px`, opacity: closing ? 1 : 0 },
          { height: `${to}px`, opacity: closing ? 0 : 1 },
        ],
        { duration: DURATION, easing: EASE },
      );
      answer.style.overflow = 'hidden';
      running.set(details, anim);
      anim.onfinish = () => {
        answer.style.overflow = '';
        if (closing) {
          details.open = false;
          delete details.dataset.closing;
          details.classList.remove('is-closing');
        }
        running.delete(details);
      };
    };
    summary.addEventListener('click', onClick);
    cleanups.push(() => summary.removeEventListener('click', onClick));
  }
  return () => cleanups.forEach((fn) => fn());
}

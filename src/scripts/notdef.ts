// 404 ".notdef": "404" cycles through the numerals of other scripts and lands on
// tofu boxes; "Read something random" picks a random publication.
// Without JS or with reduced motion, the static version stays (tofu + numeral list).
export function initNotdef(root: HTMLElement): () => void {
  const slugs: string[] = JSON.parse(root.dataset.slugs ?? '[]');
  const random = root.querySelector<HTMLAnchorElement>('[data-random]');
  if (random && slugs.length) {
    random.href = `/publications/${slugs[Math.floor(Math.random() * slugs.length)]}`;
  }

  const cycle = root.querySelector<HTMLElement>('[data-cycle]');
  const tofu = root.querySelector<HTMLElement>('[data-tofu]');
  if (!cycle || !tofu || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const steps: string[] = ['404', ...JSON.parse(cycle.dataset.steps ?? '[]')];
  let i = 0;
  cycle.hidden = false;
  tofu.classList.add('is-waiting');
  cycle.textContent = steps[0]!;
  const timer = window.setInterval(() => {
    i += 1;
    if (i < steps.length) {
      cycle.textContent = steps[i]!;
      return;
    }
    window.clearInterval(timer);
    cycle.hidden = true;
    tofu.classList.remove('is-waiting');
  }, 650);
  return () => window.clearInterval(timer);
}

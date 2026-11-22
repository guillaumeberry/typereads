// 404: "I'm feeling curious (and lucky)" opens a random publication. Without JS the
// link goes to the first one; the dot matrix animates in CSS (404.astro).
export function initNotdef(root: HTMLElement): () => void {
  const slugs: string[] = JSON.parse(root.dataset.slugs ?? '[]');
  const random = root.querySelector<HTMLAnchorElement>('[data-random]');
  if (random && slugs.length) {
    random.href = `/publications/${slugs[Math.floor(Math.random() * slugs.length)]}`;
  }
  return () => {};
}

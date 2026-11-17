// Library engine, DOM part: reads the server-rendered cards, wires search, filters,
// sort and the view toggle, and keeps the URL in sync. Exposes init/destroy so a
// client router (Phase 4) can re-run it on every page view.
import {
  activeFilterCount,
  computeCounts,
  computeVisible,
  emptyState,
  MULTI,
  parseState,
  serializeState,
  type Item,
  type State,
} from './library-core';

/** Hook for the motion layer: run `mutate`, optionally animated. */
export type Animate = (mutate: () => void, kind: 'filter' | 'sort' | 'view') => unknown;
const instant: Animate = (mutate) => mutate();

const VIEW_KEY = 'rat:view';
const MOBILE = '(max-width: 720px)';

let controller: AbortController | null = null;

export function init(root: HTMLElement, animate: Animate = instant) {
  destroy();
  controller = new AbortController();
  const { signal } = controller;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  const controls = $('[data-controls]');
  const grid = $('[data-grid]');
  const countEl = $('[data-count-total]');
  const emptyEl = $('[data-empty]');
  const search = $<HTMLInputElement>('[data-q]');
  const sortSelect = $<HTMLSelectElement>('[data-sort]');
  const form = $<HTMLFormElement>('[data-filter-form]');
  const panel = $<HTMLDialogElement>('[data-panel]');
  const toggle = $<HTMLButtonElement>('[data-filters-toggle]');
  const badge = $('[data-badge]');
  const activeList = $('[data-active]');
  const showBtn = $<HTMLButtonElement>('[data-show]');
  const viewBtns = $$<HTMLButtonElement>('[data-view]');

  const cards = $$<HTMLLIElement>('.card');
  const words = (s?: string) => (s ? s.split(' ').filter(Boolean) : []);
  const items: Item[] = cards.map((el) => {
    const d = el.dataset;
    return {
      id: d.id!,
      i: Number(d.i),
      title: d.title!,
      type: d.type!,
      formats: words(d.formats),
      langs: words(d.langs),
      tlangs: words(d.tlangs),
      scripts: words(d.scripts),
      year: Number(d.year),
      avail: d.avail!,
      text: d.s ?? '',
    };
  });
  const cardById = new Map(cards.map((el) => [el.dataset.id!, el]));
  const total = items.length;
  let state: State = parseState(location.search);

  controls.hidden = false;

  // --- render --------------------------------------------------------------
  function render() {
    const visible = computeVisible(items, state);
    const ids = new Set(visible.map((it) => it.id));

    // Show/hide, and reorder only when the order actually changes.
    const wanted = visible.map((it) => cardById.get(it.id)!);
    const current = cards.filter((c) => !c.hidden && ids.has(c.dataset.id!));
    const domOrder = [...grid.children].filter((c) => ids.has((c as HTMLElement).dataset.id!));
    for (const c of cards) c.hidden = !ids.has(c.dataset.id!);
    if (domOrder.some((c, i) => c !== wanted[i]) || current.length !== wanted.length) {
      grid.append(...wanted, ...cards.filter((c) => c.hidden));
    }

    // Faceted counts on every option; zero-result options are dimmed, never hidden.
    const counts = computeCounts(items, state);
    for (const input of form.querySelectorAll<HTMLInputElement>('input[name]')) {
      const group = input.name as keyof typeof counts;
      if (!(group in counts) || !input.value) continue;
      const n = counts[group].get(input.value) ?? 0;
      const label = input.parentElement!.querySelector('[data-count]');
      if (label) label.textContent = String(n);
      input.disabled = n === 0 && !input.checked;
    }

    // Count, badge, active chips, empty state, mobile "Show N" button.
    countEl.textContent =
      visible.length === total
        ? `${total} publications`
        : `${visible.length} of ${total} publications`;
    const nActive = activeFilterCount(state);
    badge.hidden = nActive === 0;
    badge.textContent = String(nActive);
    showBtn.textContent = visible.length === 1 ? 'Show 1 result' : `Show ${visible.length} results`;
    emptyEl.hidden = visible.length > 0;
    renderActive();
  }

  function labelFor(group: string, value: string) {
    const input = form.querySelector<HTMLInputElement>(
      `input[name="${group}"][value="${CSS.escape(value)}"]`,
    );
    const chip = input?.nextElementSibling?.cloneNode(true) as HTMLElement | undefined;
    chip?.querySelector('[data-count]')?.remove();
    return chip?.textContent?.trim() || value;
  }

  function renderActive() {
    const chips: HTMLLIElement[] = [];
    const add = (text: string, remove: () => void) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span aria-hidden="true">×</span> ';
      b.append(text);
      b.setAttribute('aria-label', `Remove filter: ${text}`);
      b.addEventListener('click', () => {
        remove();
        commit('push');
      });
      li.append(b);
      chips.push(li);
    };
    for (const g of MULTI) for (const v of state[g]) add(labelFor(g, v), () => state[g].delete(v));
    if (state.date) add(labelFor('date', state.date), () => (state.date = ''));
    if (chips.length > 1 || (chips.length && state.q)) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'reset';
      b.textContent = 'Reset all';
      b.addEventListener('click', resetAll);
      li.append(b);
      chips.push(li);
    }
    activeList.replaceChildren(...chips);
  }

  // --- state <-> controls ---------------------------------------------------
  function syncControls() {
    if (document.activeElement !== search) search.value = state.q;
    sortSelect.value = state.sort;
    for (const input of form.querySelectorAll<HTMLInputElement>('input[name]')) {
      const g = input.name;
      if (g === 'tr') input.checked = state.tr;
      else if (g === 'date') input.checked = input.value === state.date;
      else if ((MULTI as readonly string[]).includes(g)) {
        input.checked = state[g as (typeof MULTI)[number]].has(input.value);
      }
    }
  }

  function readForm() {
    const fd = new FormData(form);
    for (const g of MULTI) state[g] = new Set(fd.getAll(g).map(String));
    state.date = String(fd.get('date') ?? '');
    state.tr = fd.has('tr');
  }

  function commit(history: 'push' | 'replace' | 'none', kind: 'filter' | 'sort' = 'filter') {
    syncControls();
    animate(render, kind);
    if (history === 'none') return;
    const qs = serializeState(state);
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
    if (url === location.pathname + location.search + location.hash) return;
    // Keep any router's own history state intact.
    if (history === 'push') window.history.pushState(window.history.state, '', url);
    else window.history.replaceState(window.history.state, '', url);
  }

  function resetAll() {
    state = { ...emptyState(), sort: state.sort };
    search.value = '';
    commit('push');
  }

  // --- search -----------------------------------------------------------------
  let timer = 0;
  let descriptionsLoaded = false;
  async function loadDescriptions() {
    if (descriptionsLoaded) return;
    descriptionsLoaded = true;
    try {
      const res = await fetch('/search.json', { signal });
      const index: Record<string, string> = await res.json();
      for (const it of items) if (index[it.id]) it.text += ` ${index[it.id]}`;
      if (state.q) render();
    } catch {
      descriptionsLoaded = false; // retry on next focus
    }
  }
  search.addEventListener('focus', loadDescriptions, { signal });
  search.addEventListener(
    'input',
    () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        state.q = search.value;
        commit('replace');
      }, 120);
    },
    { signal },
  );
  search.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && search.value) {
        e.preventDefault();
        search.value = '';
        state.q = '';
        commit('replace');
      }
    },
    { signal },
  );
  // "/" focuses search from anywhere (not while typing in another field).
  document.addEventListener(
    'keydown',
    (e) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      search.focus();
    },
    { signal },
  );

  // --- filters ---------------------------------------------------------------
  form.addEventListener(
    'change',
    () => {
      readForm();
      commit('push');
    },
    { signal },
  );
  $$('[data-reset]').forEach((b) => b.addEventListener('click', resetAll, { signal }));
  root.querySelector('[data-empty-reset]')?.addEventListener('click', resetAll, { signal });

  toggle.addEventListener(
    'click',
    () => {
      if (panel.open) panel.close();
      else if (matchMedia(MOBILE).matches) panel.showModal();
      else panel.show();
      toggle.setAttribute('aria-expanded', String(panel.open));
    },
    { signal },
  );
  panel.addEventListener(
    'close',
    () => {
      toggle.setAttribute('aria-expanded', 'false');
      if (matchMedia(MOBILE).matches) toggle.focus();
    },
    { signal },
  );
  // Tapping the backdrop closes the mobile sheet.
  panel.addEventListener(
    'click',
    (e) => {
      if (e.target === panel && panel.matches(':modal')) panel.close();
    },
    { signal },
  );
  matchMedia(MOBILE).addEventListener('change', () => panel.open && panel.close(), { signal });

  // --- sort ------------------------------------------------------------------
  sortSelect.addEventListener(
    'change',
    () => {
      state.sort = sortSelect.value as State['sort'];
      commit('push', 'sort');
    },
    { signal },
  );

  // --- view ------------------------------------------------------------------
  const setView = (view: string, save: boolean) => {
    const apply = () => {
      if (view === 'list') document.documentElement.dataset.view = 'list';
      else delete document.documentElement.dataset.view;
      viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    };
    if (save) animate(apply, 'view');
    else apply();
    if (save) {
      try {
        localStorage.setItem(VIEW_KEY, view);
      } catch {
        /* private mode: the view just isn't remembered */
      }
    }
  };
  setView(document.documentElement.dataset.view === 'list' ? 'list' : 'grid', false);
  viewBtns.forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view!, true), { signal }),
  );

  // --- history -----------------------------------------------------------------
  window.addEventListener(
    'popstate',
    () => {
      state = parseState(location.search);
      commit('none');
    },
    { signal },
  );

  // First render from the URL (no history entry).
  commit('none');
  return destroy;
}

export function destroy() {
  controller?.abort();
  controller = null;
}

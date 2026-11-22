// Library engine, DOM part: reads the server-rendered cards, wires search, filters,
// sort and the view toggle, and keeps the URL in sync. Exposes init/destroy so a
// client router (Phase 4) can re-run it on every page view. The view, search and
// filter buttons live in the header ([data-lib-tools], LibraryTools.astro); the rest
// is inside `root` (index.astro).
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
/** `search` = results changing while the visitor types (must never steal focus). */
export type Animate = (mutate: () => void, kind: 'filter' | 'search' | 'sort' | 'view') => unknown;
const instant: Animate = (mutate) => mutate();

const VIEW_KEY = 'rat:view';

let controller: AbortController | null = null;

export function init(root: HTMLElement, animate: Animate = instant) {
  destroy();
  controller = new AbortController();
  const { signal } = controller;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  const tools = document.querySelector<HTMLElement>('[data-lib-tools]');
  const tool = <T extends Element = HTMLButtonElement>(sel: string) =>
    (tools ?? root).querySelector<T>(sel)!;
  const controls = $('[data-controls]');
  const searchRow = $('[data-search-row]');
  const grid = $('[data-grid]');
  const countEl = $('[data-count-total]');
  const emptyEl = $('[data-empty]');
  const search = $<HTMLInputElement>('[data-q]');
  const form = $<HTMLFormElement>('[data-filter-form]');
  const panel = $('[data-panel]');
  const toggle = tool<HTMLButtonElement>('[data-filters-toggle]');
  const searchToggle = tool<HTMLButtonElement>('[data-search-toggle]');
  const viewToggle = tool<HTMLButtonElement>('[data-view-toggle]');
  const viewLabel = viewToggle.querySelector<HTMLElement>('[data-view-label]')!;
  const viewHint = viewToggle.querySelector<HTMLElement>('[data-view-hint]');
  const filterCount = tool<HTMLElement>('[data-filter-count]');

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
  if (tools) tools.hidden = false;

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

    // The result count is for screen readers only (a live region); the Filter button
    // shows how many filters are on: "Filter (2)".
    const countText =
      visible.length === total
        ? `${total} publications`
        : `${visible.length} of ${total} publications`;
    if (countEl.textContent !== countText) countEl.textContent = countText;
    const nActive = activeFilterCount(state);
    filterCount.textContent = nActive ? ` (${nActive})` : '';
    emptyEl.hidden = visible.length > 0;
    if (state.q) showSearch(true, false);
  }

  // --- state <-> controls ---------------------------------------------------
  function syncControls() {
    if (document.activeElement !== search) search.value = state.q;
    // The panel has one choice per group (radios); value "" means "all".
    for (const input of form.querySelectorAll<HTMLInputElement>('input[name]')) {
      const g = input.name;
      if (g === 'sort') input.checked = input.value === state.sort;
      else if (g === 'date') input.checked = input.value === state.date;
      else if ((MULTI as readonly string[]).includes(g)) {
        const set = state[g as (typeof MULTI)[number]];
        input.checked = input.value ? set.has(input.value) : set.size === 0;
      }
    }
  }

  // Only the groups that are in the panel: language, script and availability can still
  // come from a URL, and picking a type mustn't clear them.
  function readForm() {
    const fd = new FormData(form);
    for (const g of MULTI) {
      if (!form.querySelector(`input[name="${g}"]`)) continue;
      state[g] = new Set(fd.getAll(g).map(String).filter(Boolean));
    }
    state.date = String(fd.get('date') ?? '');
    state.sort = (fd.get('sort') as State['sort']) ?? 'added';
  }

  function commit(
    history: 'push' | 'replace' | 'none',
    kind: 'filter' | 'search' | 'sort' = 'filter',
  ) {
    syncControls();
    animate(render, kind);
    if (history === 'none') return;
    const qs = serializeState(state);
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
    if (url === location.pathname + location.search + location.hash) return;
    // Our own state object: the router (Phase 4) ignores back/forward steps that only
    // change the query on the same page, and the popstate listener below handles them.
    const st = { source: 'library', url };
    if (history === 'push') window.history.pushState(st, '', url);
    else window.history.replaceState({ ...(window.history.state ?? {}), ...st }, '', url);
  }

  // Reset clears every filter and the sort (the panel's "Reset"), and the search.
  function resetAll() {
    state = emptyState();
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
        commit('replace', 'search');
      }, 120);
    },
    { signal },
  );
  // --- opening and closing ----------------------------------------------------
  // Panels animate in with CSS (`:not([hidden])`) and out with an `is-leaving` class;
  // `hidden` is set once the exit animation ends (at once under reduced motion).
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function leave(el: HTMLElement, done: () => void) {
    if (el.hidden) return;
    if (reducedMotion()) {
      done();
      return;
    }
    el.classList.add('is-leaving');
    const finish = (e?: Event) => {
      if (e && e.target !== el) return;
      el.removeEventListener('animationend', finish);
      if (!el.classList.contains('is-leaving')) return; // reopened meanwhile
      el.classList.remove('is-leaving');
      done();
    };
    el.addEventListener('animationend', finish);
    setTimeout(finish, 600); // in case animationend never fires
  }
  function enter(el: HTMLElement) {
    el.classList.remove('is-leaving');
    el.hidden = false;
  }

  // --- search bar ----------------------------------------------------------------
  // The header's Search button opens a bar over the header (Figma "Search field");
  // its × (or Escape) clears the search and closes it.
  const searchOpen = () => !searchRow.hidden && !searchRow.classList.contains('is-leaving');
  function showSearch(open: boolean, focus: boolean) {
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      enter(searchRow);
      if (focus) {
        search.focus({ preventScroll: true });
        search.select();
      }
    } else {
      leave(searchRow, () => (searchRow.hidden = true));
    }
  }
  function closeSearch(focusBack: boolean) {
    if (search.value || state.q) {
      search.value = '';
      state.q = '';
      commit('replace', 'search');
    }
    showSearch(false, false);
    if (focusBack) searchToggle.focus({ preventScroll: true });
  }
  searchToggle.addEventListener(
    'click',
    () => (searchOpen() ? closeSearch(false) : showSearch(true, true)),
    { signal },
  );
  $('[data-search-close]').addEventListener('click', () => closeSearch(true), { signal });
  search.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeSearch(true);
    },
    { signal },
  );

  // ⌘ K (Mac) or Ctrl K (Windows, Linux) opens the search from anywhere and selects
  // what's there so you can type over it.
  const mac = /mac|iphone|ipad/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform,
  );
  const hint = root.querySelector('[data-shortcut]');
  if (hint) hint.textContent = mac ? '⌘ K' : 'Ctrl K';
  search.setAttribute('aria-keyshortcuts', mac ? 'Meta+K' : 'Control+K');
  document.addEventListener(
    'keydown',
    (e) => {
      const k = e.key.toLowerCase() === 'k' || e.code === 'KeyK';
      if (!k || !(mac ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      showSearch(true, true);
    },
    { signal },
  );

  // --- filters ---------------------------------------------------------------
  form.addEventListener(
    'change',
    (e) => {
      const sorting = (e.target as HTMLInputElement).name === 'sort';
      readForm();
      commit('push', sorting ? 'sort' : 'filter');
    },
    { signal },
  );
  $$('[data-reset]').forEach((b) => b.addEventListener('click', resetAll, { signal }));
  root.querySelector('[data-empty-reset]')?.addEventListener('click', resetAll, { signal });

  // The panel opens under the header and pushes the publications down; choices apply
  // at once. It closes with the Filter button or Escape (focus returns to Filter).
  // Opening: the publications glide down (the library's animate hook) while the panel
  // unrolls (CSS). Closing: the panel rolls up first, then the publications glide up.
  const panelOpen = () => !panel.hidden && !panel.classList.contains('is-leaving');
  function setPanel(open: boolean, focusBack = false) {
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      animate(() => enter(panel), 'sort');
      panel.focus({ preventScroll: true });
    } else {
      leave(panel, () => animate(() => (panel.hidden = true), 'sort'));
      if (focusBack) toggle.focus({ preventScroll: true });
    }
  }
  toggle.addEventListener('click', () => setPanel(!panelOpen()), { signal });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && panelOpen()) setPanel(false, true);
    },
    { signal },
  );

  // --- view ------------------------------------------------------------------
  // One switch in the header, labelled with the current view (Figma); its hidden
  // hint says what a press does. Grid is the default; the choice is remembered in
  // localStorage (VIEW_KEY).
  const setView = (view: string, save: boolean) => {
    const apply = () => {
      if (view === 'list') document.documentElement.dataset.view = 'list';
      else delete document.documentElement.dataset.view;
      viewToggle.dataset.current = view;
      viewLabel.textContent = view === 'list' ? 'List' : 'Grid';
      if (viewHint) viewHint.textContent = ` view: show as ${view === 'list' ? 'grid' : 'list'}`;
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
  viewToggle.addEventListener(
    'click',
    () => setView(viewToggle.dataset.current === 'list' ? 'grid' : 'list', true),
    { signal },
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

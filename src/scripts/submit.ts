// Enhances the submission form (src/components/SubmitForm.astro), loaded on demand by
// boot.ts: renders the Turnstile spam check, sends in place and shows the server's errors
// next to their fields. Without this script the form still posts (worker/index.ts then
// redirects), but the spam check can't run.
type Turnstile = {
  render(el: HTMLElement, o: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('no api')));
    s.onerror = () => {
      loading = undefined;
      s.remove();
      reject(new Error('blocked'));
    };
    document.head.append(s);
  });
  return loading;
}

export function init(form: HTMLFormElement, onSuccess?: (data: FormData) => void): () => void {
  const box = form.querySelector<HTMLElement>('[data-turnstile]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  let widget: string | undefined;
  let alive = true;
  let busy = false;

  const field = (name: string) =>
    form.querySelector<HTMLElement>(`[data-error-for="${name}"]`) ??
    form.querySelector<HTMLElement>('[data-error-for="form"]');

  function clearErrors() {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
      el.textContent = '';
      if (el.dataset.errorFor === 'form') el.hidden = true;
    });
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function showErrors(errors: Record<string, string>) {
    let first: HTMLElement | undefined;
    for (const [name, msg] of Object.entries(errors)) {
      const out = field(name);
      if (!out) continue;
      out.textContent = msg;
      out.hidden = false;
      const input = form.querySelector<HTMLElement>(`[name="${name}"]`);
      input?.setAttribute('aria-invalid', 'true');
      first ??= input && input.getAttribute('type') !== 'hidden' ? input : out;
    }
    if (first) {
      if (!first.matches('input, select, textarea')) first.tabIndex = -1;
      first.focus();
    }
  }

  // Browser checks first (required, URL, lengths), shown the same way as server errors.
  function localErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const el of form.querySelectorAll<HTMLInputElement>('input, select, textarea')) {
      if (!el.name || el.validity.valid || errors[el.name]) continue;
      errors[el.name] = el.validity.valueMissing
        ? 'This is required.'
        : el.validity.typeMismatch && el.type === 'url'
          ? 'Use a full web address starting with https://'
          : el.validationMessage;
    }
    return errors;
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    clearErrors();
    const local = localErrors();
    if (Object.keys(local).length) return showErrors(local);

    busy = true;
    // Only the label changes while sending (the button keeps its arrow).
    const label = button?.querySelector<HTMLElement>('[data-label-text]') ?? button;
    if (button) button.disabled = true;
    if (label) label.textContent = 'Sending…';
    try {
      const data = new FormData(form);
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(data as unknown as Record<string, string>),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: Record<string, string>;
      };
      if (res.ok && out.ok) {
        // In the panel: show the success view with a recap; on the page: thanks page.
        if (onSuccess) onSuccess(data);
        else location.assign('/submit/thanks');
        return;
      }
      showErrors(out.errors ?? { form: 'Something went wrong. Please try again.' });
    } catch {
      showErrors({ form: 'You seem to be offline. Please try again.' });
    } finally {
      busy = false;
      if (button) button.disabled = false;
      if (label) label.textContent = button?.dataset.label ?? 'Send';
      // A Turnstile token works once: get a fresh one for the next try.
      if (widget && window.turnstile) window.turnstile.reset(widget);
    }
  }

  form.addEventListener('submit', onSubmit);

  if (box?.dataset.sitekey) {
    loadTurnstile()
      .then((t) => {
        if (!alive) return;
        widget = t.render(box, {
          sitekey: box.dataset.sitekey,
          appearance: 'interaction-only',
          theme: 'auto',
        });
      })
      .catch(() => {
        if (alive)
          showErrors({
            form: 'The spam check couldn’t load (a blocker?). Allow challenges.cloudflare.com, or email hello@typereads.xyz.',
          });
      });
  }

  return () => {
    alive = false;
    form.removeEventListener('submit', onSubmit);
    if (widget && window.turnstile) window.turnstile.remove(widget);
  };
}

// --- The submission panel (SubmitPanel.astro) ------------------------------------
// Opened by the header's "+" (boot.ts). The form inside is wired once, on first open
// (that's also when the spam check loads). Closes with ×, Escape or a click on the
// veil, after its exit animation; once a submission went through, closing also resets
// the form for a possible next one.
let panelReady = false;

export function openPanel() {
  const panel = document.querySelector<HTMLDialogElement>('[data-submit-panel]');
  if (!panel) return false;
  const form = panel.querySelector<HTMLFormElement>('form[data-submit]')!;
  const formView = panel.querySelector<HTMLElement>('[data-view="form"]')!;
  const successView = panel.querySelector<HTMLElement>('[data-view="success"]')!;
  const recap = panel.querySelector<HTMLElement>('[data-recap]')!;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!panelReady) {
    panelReady = true;
    const close = () => {
      if (!panel.open || panel.classList.contains('is-leaving')) return;
      const done = () => {
        panel.classList.remove('is-leaving');
        panel.close();
        if (!successView.hidden) {
          form.reset();
          successView.hidden = true;
          formView.hidden = false;
        }
      };
      if (reduced()) return done();
      panel.classList.add('is-leaving');
      panel.addEventListener('animationend', done, { once: true });
      setTimeout(() => panel.classList.contains('is-leaving') && done(), 500);
    };
    panel.querySelectorAll('[data-panel-close]').forEach((b) => b.addEventListener('click', close));
    panel.addEventListener('cancel', (e) => {
      e.preventDefault(); // Escape: animate out instead of closing at once
      close();
    });
    // A click on the veil (outside the panel's box) closes it.
    panel.addEventListener('click', (e) => {
      if (e.target !== panel) return;
      const r = panel.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) close();
    });
    init(form, (data) => {
      // Success: the recap of what was sent (never the email), then the thank-you view.
      const typeSelect = form.querySelector<HTMLSelectElement>('select[name="type"]');
      const name = String(data.get('name') ?? '').trim();
      const rows: [string, string][] = [
        ['Title', String(data.get('title') ?? '')],
        ['Author(s)', String(data.get('authors') ?? '')],
        ['Type', typeSelect?.selectedOptions[0]?.text ?? ''],
        ['Publisher', String(data.get('publisher') ?? '')],
        ['Your name', data.get('consent') === 'yes' ? name : ''],
      ];
      recap.replaceChildren(
        ...rows
          .filter(([, v]) => v.trim())
          .map(([k, v]) => {
            const row = document.createElement('div');
            const dt = document.createElement('dt');
            const dd = document.createElement('dd');
            dt.textContent = k;
            dd.textContent = v.trim();
            row.append(dt, dd);
            return row;
          }),
      );
      formView.hidden = true;
      successView.hidden = false;
      panel.scrollTop = 0;
      panel.querySelector<HTMLElement>('[data-success-title]')?.focus();
    });
  }

  panel.classList.remove('is-leaving');
  if (!panel.open) panel.showModal();
  panel.scrollTop = 0;
  panel.querySelector<HTMLInputElement>('input[name="title"]')?.focus({ preventScroll: true });
  return true;
}

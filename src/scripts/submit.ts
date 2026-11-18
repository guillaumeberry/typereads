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

export function init(form: HTMLFormElement): () => void {
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
    if (button) {
      button.disabled = true;
      button.textContent = 'Sending…';
    }
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: Record<string, string>;
      };
      if (res.ok && out.ok) {
        location.assign('/submit/thanks');
        return;
      }
      showErrors(out.errors ?? { form: 'Something went wrong. Please try again.' });
    } catch {
      showErrors({ form: 'You seem to be offline. Please try again.' });
    } finally {
      busy = false;
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.label ?? 'Send';
      }
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

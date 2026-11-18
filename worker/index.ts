// The site's Worker (ADR-005). Static files are served straight from the build (dist/);
// only /api/* runs this code (`run_worker_first` in wrangler.jsonc).
//
// POST /api/submit, from /submit (new publication) or /submit/fix/<slug> (correction):
//   size limit → honeypot → rate limit → Turnstile → validation (src/lib/submission.ts)
//   → new: commit a `status: submitted` entry to GitHub ("[skip ci]"), then email the editor
//   → fix: email the editor only (nothing is committed)
// Answers JSON to the page's script (Accept: application/json), otherwise redirects
// (303) to /submit/thanks or /submit/error, so the form also posts without JavaScript.
//
// Secrets (Cloudflare dashboard → typereads → Settings → Variables and Secrets, or
// .dev.vars locally, never in this repo): TURNSTILE_SECRET, GITHUB_TOKEN, NOTIFY_TO.
// DRY_RUN=1 (local testing only) skips GitHub and email and returns the file instead.
import { MAX_BODY_BYTES, parseSubmission, randomId, type Errors } from '../src/lib/submission';

interface Fetcher {
  fetch(input: Request | string): Promise<Response>;
}
interface RateLimit {
  limit(o: { key: string }): Promise<{ success: boolean }>;
}
interface SendEmail {
  send(m: {
    to: string;
    from: { email: string; name: string };
    subject: string;
    text: string;
    replyTo?: string;
  }): Promise<unknown>;
}
interface Env {
  ASSETS: Fetcher;
  EMAIL?: SendEmail;
  SUBMIT_LIMIT?: RateLimit;
  TURNSTILE_SECRET?: string;
  GITHUB_TOKEN?: string;
  NOTIFY_TO?: string;
  DRY_RUN?: string;
}

const REPO = 'guillaumeberry/typereads';
const BRANCH = 'main';
const FROM = { email: 'submissions@typereads.xyz', name: 'Read About Type' };

class Fail extends Error {
  constructor(
    readonly status: number,
    readonly errors: Errors,
  ) {
    super(Object.values(errors)[0]);
  }
}
const fail = (status: number, form: string) => new Fail(status, { form });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/submit') return submit(req, env);
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
};

async function submit(req: Request, env: Env): Promise<Response> {
  const json = (req.headers.get('Accept') ?? '').includes('application/json');
  const done = (status: number, body: Record<string, unknown>, to: string) =>
    json
      ? Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
      : new Response(null, { status: 303, headers: { Location: to } });

  try {
    if (req.method !== 'POST')
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    const type = req.headers.get('Content-Type') ?? '';
    if (!type.startsWith('application/x-www-form-urlencoded'))
      throw fail(415, 'Unsupported form encoding.');
    if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES)
      throw fail(413, 'That’s too much text. Please shorten it.');
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES)
      throw fail(413, 'That’s too much text. Please shorten it.');
    const form = new URLSearchParams(raw);

    // Bots fill every field: pretend it worked and do nothing.
    if (form.get('website')) return done(200, { ok: true }, '/submit/thanks');

    const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.SUBMIT_LIMIT && !(await env.SUBMIT_LIMIT.limit({ key: ip })).success)
      throw fail(429, 'Too many sends in a short time. Please wait a minute and try again.');

    if (!env.TURNSTILE_SECRET || (!env.DRY_RUN && (!env.GITHUB_TOKEN || !env.NOTIFY_TO)))
      throw fail(503, 'The form isn’t available right now. Please email hello@typereads.xyz.');
    await verifyTurnstile(form.get('cf-turnstile-response'), ip, env.TURNSTILE_SECRET);

    const today = new Date().toISOString().slice(0, 10);
    const parsed = parseSubmission(form, { id: randomId(), today });
    if (!parsed.ok) throw new Fail(400, parsed.errors);

    if (parsed.kind === 'fix') {
      const page = await env.ASSETS.fetch(`${new URL(req.url).origin}/publications/${parsed.slug}`);
      if (!page.ok) throw fail(400, 'This publication doesn’t exist (any more).');
    }

    if (env.DRY_RUN) return done(200, { ok: true, dryRun: true, parsed }, '/submit/thanks');

    if (parsed.kind === 'new') {
      await commit(parsed.path, parsed.content, `[skip ci] Submission: ${parsed.title}`, env);
      // The entry is safe in the Inbox; a failed email must not turn into an error page.
      await notify(env, `New submission: ${parsed.title}`, parsed.summary, parsed.email).catch(
        (e) => console.error('email failed', String(e)),
      );
    } else {
      // A correction exists only in the email, so this one has to work.
      await notify(env, `Correction: ${parsed.title}`, parsed.summary, parsed.email).catch((e) => {
        console.error('email failed', String(e));
        throw fail(502, 'Sending failed. Please email hello@typereads.xyz instead.');
      });
    }
    return done(200, { ok: true }, '/submit/thanks');
  } catch (e) {
    const err =
      e instanceof Fail
        ? e
        : (console.error('submit failed', String(e)),
          fail(
            500,
            'Something went wrong on our side. Please try again, or email hello@typereads.xyz.',
          ));
    return done(err.status, { ok: false, errors: err.errors }, `/submit/error?code=${err.status}`);
  }
}

async function verifyTurnstile(token: string | null, ip: string, secret: string) {
  if (!token)
    throw fail(
      400,
      'The spam check didn’t run. It needs JavaScript; or email hello@typereads.xyz.',
    );
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const out = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!out.success) throw fail(403, 'The spam check failed. Please reload the page and try again.');
}

async function commit(path: string, content: string, message: string, env: Env) {
  const bytes = new TextEncoder().encode(content);
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'typereads-submit',
    },
    body: JSON.stringify({
      message,
      branch: BRANCH,
      content: btoa(String.fromCharCode(...bytes)),
    }),
  });
  if (!res.ok) {
    console.error('github commit failed', res.status);
    throw fail(502, 'Saving failed. Please try again, or email hello@typereads.xyz.');
  }
}

async function notify(env: Env, subject: string, summary: string, email?: string) {
  if (!env.EMAIL || !env.NOTIFY_TO) throw new Error('email not configured');
  const text = [
    summary,
    '',
    `Reply to: ${email ?? '(no email given)'}`,
    '',
    'Review in the Inbox: https://typereads.xyz/admin/',
  ].join('\n');
  await env.EMAIL.send({
    to: env.NOTIFY_TO,
    from: FROM,
    subject: subject.slice(0, 150),
    text,
    ...(email && { replyTo: email }),
  });
}

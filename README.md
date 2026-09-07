# Outpost

Type an address. Outpost fills your template, lets you edit it, and sends it at
the minute you picked — from your own Namecheap mailbox, with a copy in Sent.

The important part is not the email. It is the `jobs` table: one queue, one
runner, one handler per kind. Reminders, todos and scheduled posts are later
handlers on the same machinery, not new subsystems.

```
lib/jobs/runner.ts            the queue: claim, retry, reclaim, alert
lib/jobs/registry.ts          register(kind, handler)
lib/jobs/handlers/            one file per kind of scheduled work
  email-send.ts               the only handler so far
```

---

## 1. Database

Create a free project at [supabase.com](https://supabase.com). Then:

1. **SQL Editor → New query**, paste all of `db/schema.sql`, **Run**.
2. **Project Settings → Database → Connection string → Transaction pooler**
   (port `6543`). Copy it and put your password in.

> Supabase is the right free tier here specifically because the minute-tick
> keeps the project active. Neon's free plan meters compute-hours and would
> suspend the project partway through the month.

## 2. Mailbox

In the Namecheap Private Email dashboard:

1. Generate an **application password** (not your master password — you want to
   be able to revoke this one on its own).
2. Confirm **DKIM** is enabled for the domain.

Settings the app uses, for reference:

| | Host | Port | Encryption |
|---|---|---|---|
| SMTP | `mail.privateemail.com` | 465 | SSL/TLS |
| IMAP | `mail.privateemail.com` | 993 | SSL/TLS |

## 3. Run it locally

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

Generate the cron secret with `openssl rand -hex 32` (or any 32-byte hex
string).

Now prove the loop end to end:

1. Open <http://localhost:3000>, enter your own address, click **Draft**.
2. Edit the body, set the send time a couple of minutes out, **Approve & schedule**.
3. Fire a tick by hand instead of waiting for Cloudflare:

```bash
node --env-file=.env.local scripts/tick.mjs
```

It prints what it claimed and what happened. When the time arrives, the mail
lands and a copy appears in your Sent folder.

## 4. Deploy

Two separate deployments to two separate services. They only know about each
other through a URL and a shared secret.

| | Where it runs | What deploys it |
|---|---|---|
| The app (`app/`, `lib/`) | Vercel | git push |
| The heartbeat (`worker/`) | Cloudflare | `wrangler deploy`, from your machine |

Vercel never looks inside `worker/`, and Cloudflare never sees the app's code.
Do them in this order, because the worker needs the app's URL.

### 4a. The app, on Vercel

Push to a **personal** GitHub repo (Hobby cannot connect to org repos), import
it, and add every variable from `.env.example` to the project. Vercel runs its
own `npm install` from the root `package.json` — you do nothing locally for
this. Note the deployed URL.

### 4b. The worker, on Cloudflare

All of this runs **on your own machine**, in a terminal. `npm install` here
installs the `wrangler` CLI locally so you can deploy from your laptop — it has
nothing to do with Vercel, and nothing in `worker/node_modules` is ever
uploaded anywhere. Wrangler bundles `src/index.ts` and sends only that.

```bash
cd worker
npm install                                  # local: installs the wrangler CLI
npx wrangler login                           # opens a browser, one time only
```

Then set `OUTPOST_URL` in `wrangler.toml` to the Vercel URL from 4a (no
trailing slash), and:

```bash
npx wrangler secret put CRON_SHARED_SECRET   # paste the SAME value as in Vercel
npx wrangler deploy
npx wrangler tail                            # watch it tick, once a minute
```

The secret is stored by Cloudflare, not in `wrangler.toml` — which is committed,
so never put it there. If the two secrets do not match exactly, every tick comes
back `401` and nothing sends; `wrangler tail` shows that immediately.

To sanity-check the bundle without deploying anything:

```bash
npx wrangler deploy --dry-run
```

### 4c. Cloudflare Access (optional but recommended)

This app can send mail as you, so put Google login in front of it in Zero Trust.

> ⚠️ Add a **bypass policy for `/api/cron/*`** when you do. Otherwise the
> Worker's request gets an HTML login page instead of your handler and nothing
> ever sends. That path protects itself with the HMAC.

## 5. Templates

Template and message bodies are **rich text**. The toolbar gives you bold,
italic, underline, strikethrough, bulleted and numbered lists, links, quotes and
clear-formatting — deliberately no headings, colours, font sizes or images,
because those are what make a one-to-one email look like a marketing blast, and
they are also what email clients render worst.

What you see in the editor is what gets sent. A plain-text version is generated
from it automatically and sent alongside as the `text/plain` alternative; a
message with no plain-text part looks like bulk mail to spam filters.

Everything you type is sanitized **on the server** against a small allowlist
before it is stored, so pasting from Word or a web page drops the `mso-` junk,
classes and inline styles rather than carrying them into your email.

Variables
are `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{role}}`, `{{email}}`
and `{{my_name}}`. Anything unfilled stays visible as `{{like_this}}` and
**blocks scheduling** — both in the UI and again in the handler.

Missing contact fields are guessed from the address (first name from the local
part, company from the domain) and shown as editable defaults. They are never
used silently, and a value you have corrected is never overwritten.

## Pages

| | |
|---|---|
| `/` | Compose from an address, and the outbox |
| `/message/[id]` | Review, fill blanks, preview, schedule |
| `/contacts` | Add, edit and delete people |
| `/templates` | Outreach and follow-up templates, one default each |

A contact with a draft or scheduled message cannot be deleted, and your last
remaining template cannot be deleted either. Deleting the default template
promotes the oldest remaining one, so there is always something to fall back on.

## Filling blanks

Anything the template could not fill stays visible as `{{like_this}}` and blocks
scheduling. On the review screen the blanks Outpost recognises
(`first_name`, `last_name`, `company`, `role`) appear as inputs: type a value,
press **Fill in**, and it is written to the contact *and* substituted into this
draft. Substituted in place, not re-rendered -- whatever you had already edited
by hand survives. The next draft to that person starts with the value already
there.

## Follow-ups

Open a **sent** message and press **Write follow-up**. Outpost drafts a reply
from your default follow-up template, addressed to the same person, and threads
it properly: `In-Reply-To` and `References` carry the original's Message-Id, and
the subject becomes `Re: <original>`. It lands under the original in their mail
client rather than arriving as a separate email. Review and schedule it exactly
like any other message.

A follow-up template with a **blank subject** inherits `Re: <original subject>`.
That is usually what you want -- Gmail groups on subject as well as headers.
Give it a subject only if you deliberately want to break out of the thread.

Threads are visible on the message page and marked with `↳` in the outbox, so a
three-message chain reads as one conversation.

> **Outpost cannot see your inbox — by design.** It has no idea whether someone
> has replied, so it will happily send a follow-up to a person who answered you
> yesterday. Check before you schedule. Everything currently queued is listed
> under **Going out next** on the home page with a one-click cancel, so nothing
> should ever surprise you.

## A note on placeholders in rich text

If you bold half of a placeholder, the underlying HTML becomes
`{{first<strong>_name}}` and a naive renderer would send "Hi {{first_name}}".
Outpost repairs that on save: it strips markup found between `{{` and `}}`, then
re-sanitizes. If a placeholder somehow survives unrendered, the scheduling guard
still refuses the send, so the worst case is a clear error rather than a bad
email.

## Applying a migration

`db/schema.sql` is for a fresh database. When the schema changes, a numbered
file appears in `db/migrations/` — paste it into the Supabase SQL editor and
run it. They are idempotent, so running one twice is harmless.

## How the queue behaves

- Claims with `FOR UPDATE SKIP LOCKED`, so overlapping ticks skip each other's
  rows instead of double-sending.
- A job stuck in `running` for 5 minutes (killed function, crashed deploy) is
  reclaimed on a later tick.
- Retries back off 1, 2, 4 minutes, up to `max_attempts`. Then the job fails,
  the message is marked failed, and **you get an email about it**.
- `smtp_message_id` is written the moment SMTP accepts. A retry after a crash
  sees it and refuses to send again.
- `MAX_SENDS_PER_HOUR` (default 20) throttles well under the mailbox's 500/hour
  ceiling — a personal account emitting 200 near-identical mails in an hour is
  what spam filtering is built to notice.
- Times are stored `timestamptz` in UTC and only ever converted for display,
  using `APP_TZ`.

## Adding the next module

```ts
// lib/jobs/handlers/reminder-fire.ts
import { register } from "../registry";

register("reminder.fire", {
  async run(payload) {
    // ...
    return { ok: true };
  },
});
```

Then add one line to `lib/jobs/index.ts`. That is the whole cost — retries,
reclaim, the audit trail and the failure alert all come for free.

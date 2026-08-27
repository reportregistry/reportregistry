# ReportRegistry — Setup Guide

Free to file a report. Subscription required to search (search returns a
yes/no scam verdict only — never the underlying report). Stack: Next.js on
Vercel, Clerk for auth, Supabase for database + file storage, Stripe for
subscriptions. Your IONOS Cloud VPS is not used by this stack — it's only
where the domain's DNS gets pointed at Vercel.

## 1. Supabase (database + storage)

1. Create a project at supabase.com.
2. Go to **SQL Editor > New query**, paste the contents of
   `supabase/schema.sql`, and run it. This creates the `reports` and
   `subscribers` tables.
3. Go to **Storage**, create a new bucket named `evidence`, and set it to
   **public**. This is where report screenshots/photos are stored.
4. Go to **Project Settings > API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret — never
     expose this to the browser)
5. Import existing reports (optional): go to **Table Editor > reports >
   Insert > Import data from CSV** and upload `reports_import.csv` (in the
   parent folder, one level up from this app). It's pre-formatted to match
   the table columns exactly, converted from the old Google Sheets data.
   Note: the report text was lightly cleaned up (profanity/insults toned
   down) but not fully rewritten — skim it before it goes live, since
   every row imports with `status = approved`, meaning it's immediately
   live in search results. Change rows to `pending` first in the CSV (or
   after import in Table Editor) if you'd rather review before publishing.

## 2. Clerk (auth)

1. Create an application at clerk.com.
2. Go to **API Keys** and copy:
   - `Publishable key` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `Secret key` → `CLERK_SECRET_KEY`
3. Defaults in `.env.local.example` already point Clerk's sign-in/up flows
   at `/sign-in`, `/sign-up`, and post-auth redirects to `/dashboard` — no
   extra config needed in Clerk's dashboard for this.

## 3. Stripe (subscriptions + priority-search credits)

Three products, three prices:

1. In the Stripe dashboard, go to **Product catalog > Add product** and
   create three prices:
   - Monthly subscription, $7.49/month, recurring → `STRIPE_PRICE_ID_MONTHLY`
   - Annual subscription, $74.99/year, recurring → `STRIPE_PRICE_ID_ANNUAL`
   - Priority-search credit pack, $10 one-time (grants 50 credits, handled
     in code — nothing to configure on Stripe's side beyond the price
     itself being one-time, not recurring) → `STRIPE_PRICE_ID_CREDITS`
2. Go to **Developers > API keys** and copy the **Secret key** →
   `STRIPE_SECRET_KEY`.
3. Go to **Developers > Webhooks > Add endpoint**:
   - Endpoint URL: `https://YOUR_DOMAIN/api/stripe/webhook`
     (use a tool like `stripe listen --forward-to localhost:3000/api/stripe/webhook`
     for local testing before you deploy)
   - Events to send: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

## 4. Anthropic (not used)

The "smart report" screenshot auto-fill feature was removed -- reports are
reviewed manually by staff instead. `ANTHROPIC_API_KEY` in `.env.local` can
be left blank; nothing reads it.

## 5. Cloudflare Turnstile (CAPTCHA on the public report form)

Blocks bots from spamming the free, no-login report form. Skip this and
the form still works, it just won't verify the submitter is human.

1. Go to the Cloudflare dashboard → **Turnstile** → **Add site**. Add
   `reportregistry.com` (and `localhost` for local testing).
2. Copy the **Site key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Copy the **Secret key** → `TURNSTILE_SECRET_KEY`.

## 6. Local setup

```bash
cp .env.local.example .env.local
# fill in all the values from steps 1–5
npm install
npm run dev
```

Visit `http://localhost:3000`. Sign up, subscribe (use Stripe test card
`4242 4242 4242 4242`), and you should land on `/dashboard` with search
and bulk-report unlocked once the webhook fires.

## 7. Deploy to Vercel

1. Push this folder to a GitHub repo, then import it at vercel.com.
2. Add all the same env vars from `.env.local` in Vercel's project
   settings, but set `NEXT_PUBLIC_BASE_URL` to your real domain
   (`https://reportregistry.com`).
3. Update the Stripe webhook endpoint URL to your real domain once
   deployed, and update `STRIPE_WEBHOOK_SECRET` if it changes.

## 8. Point reportregistry.com (IONOS) at Vercel

1. In Vercel: **Project > Settings > Domains > Add** `reportregistry.com`.
   Vercel will show you the DNS records to set.
2. In IONOS: **Domains & SSL > reportregistry.com > DNS**, add the A/CNAME
   records Vercel gave you (typically an `A` record for the root domain
   pointing at Vercel's IP, and a `CNAME` for `www`).
3. DNS can take up to 24-48 hours to propagate, though it's often much
   faster.

## Moderation & deletion (MVP)

There's no admin panel yet — moderation happens directly in Supabase:

- **Approve a report** (so it counts in search results): Table Editor >
  `reports` > change `status` from `pending` to `approved`.
- **Delete a report** (takedown/removal request): delete the row, and
  delete any associated file(s) in the `evidence` storage bucket.

This satisfies "fully deletable" for now. An admin UI can be built later
on top of the same `reports` table.

## What search actually returns

By design, `/api/search` only ever returns `{ isScam: true | false }`. It
never returns report text, reporter info, or evidence — that's a
deliberate legal/privacy choice, not a missing feature.

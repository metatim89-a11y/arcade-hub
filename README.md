# Arcade Hub

React/Vite arcade with Supabase-managed player authentication, private profiles, anonymous privacy-minimal analytics, and a database-authorized admin dashboard.

## Local setup

Requirements: Node.js 22 or newer.

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Fill in the project URL, publishable key, and admin login email.
4. Start the app with `npm run dev`.

Only use a Supabase **publishable** key in `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put a secret key, legacy `service_role` key, database password, or user password in a `VITE_*` variable. Vite exposes every `VITE_*` value to the browser.

## Supabase project

The production project is `arcade-hub` (`ybgxtqzoevcmondbddsc`) in AWS US East (Ohio). Its schema is tracked in [`supabase/migrations`](supabase/migrations).

Authentication and data behavior:

- Supabase Auth hashes and manages passwords; the application never stores them itself.
- Players may read and update only their own profile.
- An administrator is authorized by membership in `public.admin_users`, not by editable user metadata.
- Anonymous analytics stores a random visitor UUID, event type, optional game ID, and timestamp. It does not store IP addresses, chat, payment details, or wallet secrets in application tables.
- The admin dashboard RPC checks `auth.uid()` and rejects users without an `admin_users` assignment.

In Supabase Dashboard → Authentication → URL Configuration, set:

- Site URL: `https://metatim89-a11y.github.io/arcade-hub/`
- Redirect URL: `https://metatim89-a11y.github.io/arcade-hub/`
- Local redirect URL: `http://localhost:3000/arcade-hub/`

## GitHub Pages deployment

In GitHub → `metatim89-a11y/arcade-hub` → Settings → Secrets and variables → Actions, add repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Add this repository variable:

- `VITE_ADMIN_EMAIL` — the email of the Supabase Auth account that may sign in using the `admin` alias
- `VITE_PAYPAL_URL` — optional PayPal.Me or PayPal Payment Link shown on the Support page

The workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) injects those values only during the Vite build and deploys `dist` to GitHub Pages. The project URL and publishable key are safe in a public browser bundle; database security comes from authentication and row-level security.

The app includes a Support Arcade Hub page with a GitHub sponsorship/contact link. It is intentionally payment-neutral until the owner creates a payout account; add the verified payment link to `components/SupportPage.tsx` when one is available.

## Commands

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run repo:check` — compare this checkout with GitHub and ask before synchronizing
- `bash custom.sh help` — list the complete project-local commands and aliases

When this directory is active in the Termux project shell, `.project/termux.sh`
loads the project-scoped aliases from `.ali`. Every alias delegates to a complete
command implemented by `custom.sh`; the full mappings are recorded in `motd`.

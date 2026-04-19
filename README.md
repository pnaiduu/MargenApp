# Margen Web App

Owner dashboard + technician app backed by Supabase.

## Local dev

1) Install and run the web app:

```bash
npm i
npm run dev
```

2) Set web env vars in `.env` (see `.env.example`).

## Payments (Stripe + Twilio)

This repo includes:

- **Invoices** stored in Supabase (`public.invoices`)
- **Stripe Connect (Express)** onboarding from the Settings page so payments deposit into the owner’s bank
- **Stripe Checkout links** generated per invoice (branded as the owner’s Stripe account)
- **Twilio SMS** invoice sending + reminder texts
- **Stripe webhook** to mark invoices/jobs as paid (drives “instant” dashboard updates via realtime)

### Database

Apply migration:

- `supabase/migrations/007_payments_invoices.sql`

### Supabase Edge Functions

Functions live under `supabase/functions/*`:

- `stripe-connect-start`: create/connect an owner’s Stripe account and return onboarding link
- `stripe-connect-sync`: refresh Stripe charges/details flags into `public.profiles`
- `create-invoice`: create invoice + Stripe Checkout + (optional) send SMS
- `send-invoice-reminder`: send a polite reminder SMS for unpaid invoices
- `stripe-webhook`: handle Stripe events and mark invoice/job paid

Set these as **Supabase Function secrets** (not Vite env vars):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SITE_URL` (e.g. `https://app.yourdomain.com`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

### Stripe setup checklist

- Create a Stripe Connect (Express) platform
- Add a webhook endpoint pointing to the deployed `stripe-webhook` function
- Listen for `checkout.session.completed`

### Twilio setup checklist

- Buy/configure a sending number (SMS-capable)
- Set `TWILIO_FROM_NUMBER` to that E.164 phone number

## Notifications

Notifications are stored in Supabase (`public.notifications`) and delivered in real-time to both apps.

- **Owner (web)**: bell icon in the dashboard header with unread badge + slide-in panel, backed by realtime.
- **Technician (mobile)**: Expo Push Notifications token registration via `register-expo-push-token`.

### Database

Apply migration:

- `supabase/migrations/008_notifications.sql`

### Supabase Edge Functions

- `register-expo-push-token`: technicians register/update their Expo push token
- `cancel-job`: cancel a job with reason, send customer SMS, and technician push
- `technician-unavailable-reassign`: mark technician unavailable and auto-reassign their active jobs

### Expo push notes

Server-side push delivery requires calling Expo’s push API (`https://exp.host/--/api/v2/push/send`) with saved tokens.
This repo currently sends a best-effort push for **payment processed** from the Stripe webhook.
It also sends best-effort pushes for **job cancelled** and **new job assigned** during reassignment.

## Job cancellation + reassignment

### Database

Apply migration:

- `supabase/migrations/009_job_cancellation_and_reassign.sql`

### Behavior

- Owner can cancel jobs from the Jobs page with a reason.
- Cancelling:
  - sets `jobs.status='cancelled'` and records `cancel_reason`, `cancelled_at`, `cancelled_by`
  - sends customer SMS: “Your appointment has been cancelled…”
  - sends technician push: “Job at [address] has been cancelled”
  - frees up the technician (sets status back to `available`) if they have no other in-progress jobs
- “Technician unavailable”:
  - marks technician `off_duty`
  - reassigns their `pending`/`in_progress` jobs to the best available technician by:
    - **skill match** (`technicians.skills` contains `jobs.job_type`, or skills list is empty)
    - **distance** between technician `last_lat/lng` and customer `lat/lng` when present
  - sends owner a summary notification with who each job was reassigned to

## Emergency jobs

### Database

Apply migrations:

- `supabase/migrations/010_emergency_jobs.sql`

### Supabase Edge Functions

- `create-job`: creates jobs and applies emergency behavior (auto-assign + push + owner notification)
- `acknowledge-emergency`: technician acknowledges an emergency job
- `emergency-reassign-sweep`: reassigns emergency jobs not acknowledged within 5 minutes

### Scheduling the auto-reassign sweep

Deploy `emergency-reassign-sweep` and run it every minute using your scheduler of choice (Supabase scheduled functions or external cron).

- Set a function secret `EMERGENCY_SWEEP_SECRET`
- Call with header `x-sweep-secret: <secret>`


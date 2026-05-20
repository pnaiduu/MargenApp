# Margen Technician

Production-oriented **Expo SDK 54** field app for Margen technicians: **Expo Router**, **light UI** (white / `#FAFAF8` / `#111111`), **owner accent** from `profiles.accent_hex` / `accent_color`, **56px tap targets**, **Moti** transitions, **Supabase Realtime** on today’s jobs, **offline queue**, **GPS every 60s** while clocked in (plus optional `technicians_live` sync), **Expo Notifications** with **`register-expo-push-token`** Edge Function (fallback to direct upsert), **job photos** → Storage bucket **`job-photos`**, and **in-app customer rating** after job completion (see `schema/job_ratings.sql`).

## Location

`MargenApp/MargenTechApp/` — all app code stays in this folder.

## Supabase

Defaults are in `app.json` → `extra` (same project as web). Override anytime with:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Apply main-repo migrations (notably **`005_technician_invites.sql`**, **`006_technician_mobile.sql`**, **`022_catch_all.sql`**). Then, for this app:

1. Run **`schema/job_ratings.sql`** in the SQL editor so ratings save from the device.
2. Optionally run **`schema/technicians_live_technician.sql`** so technicians can upsert their map row (otherwise GPS still updates **`technicians`**).

Create a public **`job-photos`** storage bucket (or private + signed URLs — the app uses `getPublicUrl` today).

## Run

```bash
cd MargenTechApp
npm install
npx expo start
```

Entry: **`expo-router/entry`** (`app/_layout.tsx`).

## Maps

Configure Google Maps / Apple Maps per [Expo MapView](https://docs.expo.dev/versions/latest/sdk/map-view/) for release builds.

## Auth

Technicians sign in with Supabase Auth; `technicians.user_id` must match their user (web invite flow).

## Customer ratings (in-app)

Completing a job opens **`/(main)/rating`** with `jobId`. The customer enters a **matching phone number** and stars; data goes to **`job_ratings`** (after you run the schema SQL). If the table is missing, the UI explains what to run.

## Offline

Job/technician patches queue to AsyncStorage and flush when online (`ClockContext` + `offlineQueue.ts`).

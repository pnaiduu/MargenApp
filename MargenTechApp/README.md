# Margen Technician

React Native (Expo) field app for technicians: **dark-first UI**, large tap targets, **Moti** animations (Reanimated, Framer Motion–style API), offline queue + sync, and **GPS pings every 60s** while clocked in.

## Location in this repo

This project lives at `MargenApp/MargenTechApp/` so it stays inside the git workspace. You can move the folder next to `MargenApp` on disk if you prefer; update paths accordingly.

## Setup

1. Copy `.env.example` → `.env` and set:

   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_CUSTOMER_RATE_BASE_URL` — same public origin as the Margen web app (e.g. `https://trymargen.com`) so QR codes open `/rate?token=…`.

2. Apply Supabase migrations from the main app, especially **`006_technician_mobile.sql`**.

3. Install and run:

   ```bash
   cd MargenTechApp
   npm install
   npx expo start
   ```

4. **Maps:** For standalone iOS/Android builds, configure Google Maps API keys per [Expo Maps docs](https://docs.expo.dev/versions/latest/sdk/map-view/).

## Auth & roles

Technicians use the same Supabase Auth users as the web app, with a row in `technicians` where `user_id` matches their auth user (invite flow on web).

## Customer ratings

After **Job complete** (online), the app creates a row in `job_customer_ratings` and shows a **one-time QR** pointing at:

`{EXPO_PUBLIC_CUSTOMER_RATE_BASE_URL}/rate?token=…`

The public **CustomerRatePage** in the web app (`/rate`) calls `submit_customer_rating`. Technicians cannot submit ratings from the app.

## Offline behavior

- Job and technician patches are **queued** in AsyncStorage and flushed when the network returns.
- **Clock in** while offline queues a session insert; **clock out** uses `clock_out_open` to close the latest open session after sync.
- Completing a job **offline** does not create a rating QR until you are online and complete again (or add a follow-up flow).

## Animations

The product brief asked for Framer Motion–style motion. On React Native this project uses **Moti** (Reanimated), which follows the same mental model as Framer Motion for enter/exit and transitions.

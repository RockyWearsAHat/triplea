# Netlify Deployment Guide

This guide explains how to deploy the Triple A Apps suite to Netlify.

## Architecture Overview

The project consists of three frontend apps and one serverless backend, deployed as a **single Netlify site** with **host-based subdomain routing**:

- **Triple A Muse** (`muse.tripleamusic.org`) - Brand gateway & rentals/services
- **Triple A Music** (`music.tripleamusic.org`) - Consumer marketplace & tickets
- **Triple A Musician** (`musician.tripleamusic.org`) - Performer dashboard
- **API** - Express server running as Netlify Functions (shared across all apps)

## Quick Start Deployment

### 1. Create ONE Netlify Site

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connect your GitHub/GitLab repo
3. **Leave base directory empty** (use root)
4. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
5. Click **Deploy**

### 2. Add Custom Domains

In **Site settings** → **Domain management** → **Add custom domain**:

| Domain                      | Routes to           |
| --------------------------- | ------------------- |
| `tripleamusic.org`          | Music app (default) |
| `music.tripleamusic.org`    | Music app           |
| `muse.tripleamusic.org`     | Muse app            |
| `musician.tripleamusic.org` | Musician app        |

### 3. Set Environment Variables

In **Site settings** → **Environment variables**, add:

```
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-random-secret
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## How It Works

The build process:

1. Builds all 3 apps into their own `dist/` folders
2. Copies them into a unified structure:
   ```
   dist/
   ├── music/      ← TripleAMusic/dist/*
   ├── musician/   ← TripleAMusician/dist/*
   └── muse/       ← TripleAMuse/dist/*
   ```
3. Netlify's `netlify.toml` uses **host-based redirects** to route:
   - `muse.*.org` → `/muse/*`
   - `musician.*.org` → `/musician/*`
   - `music.*.org` or root → `/music/*`

## Environment Variables

### Required

| Variable                | Description                         |
| ----------------------- | ----------------------------------- |
| `MONGO_URI`             | MongoDB Atlas connection string     |
| `JWT_SECRET`            | Strong random secret for JWT tokens |
| `STRIPE_SECRET_KEY`     | Stripe secret key                   |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret       |

### Optional

| Variable                      | Description                            |
| ----------------------------- | -------------------------------------- |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend)      |
| `VITE_GOOGLE_MAPS_API_KEY`    | Google Maps API key                    |
| `SEED_DEMO_DATA`              | Set to `true` for demo data (dev only) |

## MongoDB Setup

For production, use MongoDB Atlas:

1. Create a free cluster at https://cloud.mongodb.com
2. Create a database user
3. Whitelist Netlify IPs (or use `0.0.0.0/0` for any IP)
4. Get the connection string and set it as `MONGO_URI`

## Stripe Webhooks

Configure Stripe webhooks for your Netlify site:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://tripleamusic.org/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`, etc.
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Local Development

```bash
# Install dependencies
npm install

# Start all apps + server
npm run dev
```

URLs in development:

- Muse: http://localhost:5175
- Music: http://localhost:5173
- Musician: http://localhost:5174
- API: http://localhost:4000

## Build Commands

```bash
# Build all apps (unified)
npm run build

# Build individual apps only
npm run build --prefix TripleAMuse
npm run build --prefix TripleAMusic
npm run build --prefix TripleAMusician
```

## Troubleshooting

### CORS Errors

The server automatically allows origins from your Netlify sites. Check that your site URL matches the expected subdomain pattern.

### MongoDB Connection Errors

1. Ensure MongoDB Atlas IP whitelist includes `0.0.0.0/0`
2. Verify the connection string format
3. Check that the database user has proper permissions

### Function Timeouts

Netlify Functions have a 10-second timeout (26s for Pro). Optimize queries or upgrade to Pro for longer operations.

## File Structure

```
/
├── netlify.toml              # Unified Netlify config with host-based routing
├── netlify/
│   └── functions/
│       └── api.ts            # Serverless function entry point
├── dist/                     # Built output (after npm run build)
│   ├── music/
│   ├── musician/
│   └── muse/
├── server/
│   └── src/
│       └── serverless.ts     # Serverless wrapper
├── packages/
│   └── shared/               # Shared components & types
├── TripleAMuse/
├── TripleAMusic/
└── TripleAMusician/
```

## Adding Custom Domains to netlify.toml

If you use different domains, update the `conditions.Host` arrays in `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/muse/:splat"
  status = 200
  force = true
  conditions = {Host = ["muse.yourdomain.com", "muse.yourdomain.org"]}
```

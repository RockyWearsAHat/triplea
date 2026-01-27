# Netlify Deployment Guide

This guide explains how to deploy the Triple A Apps suite to Netlify.

## Architecture Overview

The project consists of three frontend apps and one serverless backend:

- **Triple A Muse** (`muse.<site>.netlify.app`) - Brand gateway & rentals/services
- **Triple A Music** (`music.<site>.netlify.app`) - Consumer marketplace & tickets
- **Triple A Musician** (`musician.<site>.netlify.app`) - Performer dashboard
- **API** - Express server running as Netlify Functions

## Deployment Options

### Option 1: Three Separate Netlify Sites (Recommended)

Deploy each app as a separate Netlify site with subdomain routing:

1. Create three Netlify sites:
   - `muse-triplea` → Custom domain: `muse.yourdomain.com`
   - `music-triplea` → Custom domain: `music.yourdomain.com`
   - `musician-triplea` → Custom domain: `musician.yourdomain.com`

2. For each site, set the base directory:
   - Muse: `TripleAMuse`
   - Music: `TripleAMusic`
   - Musician: `TripleAMusician`

3. Build settings (auto-detected from each app's `netlify.toml`):
   - Build command: `cd .. && npm install && npm run build --prefix TripleAMuse` (adjust per app)
   - Publish directory: `dist`

### Option 2: Single Site with Branch Deploys

Use Netlify's branch deploys to host all three apps:

- `main` branch → Music app
- `muse` branch → Muse app
- `musician` branch → Musician app

## Environment Variables

Set these in your Netlify site settings (Site Settings → Environment Variables):

### Required

```
MONGO_URI=mongodb+srv://...        # MongoDB Atlas connection string
JWT_SECRET=your-jwt-secret         # Strong random secret
STRIPE_SECRET_KEY=sk_live_...      # Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...    # Stripe webhook secret
```

### Optional

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Stripe publishable key
VITE_GOOGLE_MAPS_API_KEY=...             # Google Maps API key
SEED_DEMO_DATA=false                      # Set to false in production
```

### Auto-Detected (Don't Set Manually)

These are automatically provided by Netlify:

- `NETLIFY` - Set to `true` when running on Netlify
- `URL` - The main site URL
- `DEPLOY_PRIME_URL` - The deploy-specific URL

## MongoDB Setup

For production, use MongoDB Atlas:

1. Create a free cluster at https://cloud.mongodb.com
2. Create a database user and whitelist Netlify IPs (or use 0.0.0.0/0 for any IP)
3. Get the connection string and set it as `MONGO_URI`

## Stripe Webhooks

Configure Stripe webhooks for your Netlify site:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://music.yourdomain.com/.netlify/functions/api/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`, etc.
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Local Development

The apps automatically detect the local environment and use localhost URLs:

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
# Build all apps
npm run build

# Build individual apps
npm run build --prefix TripleAMuse
npm run build --prefix TripleAMusic
npm run build --prefix TripleAMusician
npm run build --prefix server
```

## Troubleshooting

### CORS Errors

The server automatically allows origins from your Netlify sites. If you see CORS errors:

1. Check that your site URL matches the expected subdomain pattern
2. Verify environment variables are set correctly

### MongoDB Connection Errors

1. Ensure MongoDB Atlas IP whitelist includes Netlify's IPs (or 0.0.0.0/0)
2. Verify the connection string format is correct
3. Check that the database user has proper permissions

### Function Timeouts

Netlify Functions have a 10-second timeout by default (26s for Pro). If operations time out:

1. Optimize database queries
2. Consider upgrading to Netlify Pro for longer timeouts
3. Use background functions for long-running tasks

## File Structure

```
/
├── netlify.toml              # Root Netlify config
├── netlify/
│   └── functions/
│       └── api.ts            # Serverless function entry point
├── server/
│   └── src/
│       ├── index.ts          # Express server (local dev)
│       └── serverless.ts     # Serverless wrapper
├── packages/
│   └── shared/
│       └── src/
│           └── lib/
│               └── env.ts    # Environment-aware URL config
├── TripleAMuse/
│   └── netlify.toml
├── TripleAMusic/
│   └── netlify.toml
└── TripleAMusician/
    └── netlify.toml
```

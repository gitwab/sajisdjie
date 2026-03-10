# 🕵️ RoSnitch — Roblox Intelligence Bot

A Discord bot that lets you investigate any Roblox account. Deployed on **Vercel** (100% free).

## Commands

| Command | Description |
|---|---|
| `/altcheck <username>` | Detect if account is likely an alt |
| `/trust <username>` | Trading trust score |
| `/safe <username>` | Is this person safe to play with? |
| `/worth <username>` | Estimate account value in Robux |
| `/groups <username>` | Scan groups for suspicious activity |
| `/roast <username>` | 🔥 Roast their account stats |
| `/growth <username>` | Track account changes over time |
| `/report <username>` | Full intelligence report |
| `/compare <user1> <user2>` | Side-by-side battle |

---

## Setup Guide

### Step 1 — Create Discord Bot
1. Go to https://discord.com/developers/applications
2. **New Application** → name it `RoSnitch`
3. **Bot** tab → **Reset Token** → copy it
4. Enable **Message Content Intent**
5. Copy **Application ID** and **Public Key** from General Information

### Step 2 — Invite bot to your server
Replace `YOUR_CLIENT_ID`:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

### Step 3 — Deploy to Vercel
1. Go to https://vercel.com → sign up free (no card needed)
2. Push this folder to a GitHub repo
3. In Vercel → **New Project** → import your repo
4. Add these environment variables:
   - `DISCORD_TOKEN` = your bot token
   - `DISCORD_PUBLIC_KEY` = your public key
   - `DISCORD_APP_ID` = your application ID
   - `ANTHROPIC_API_KEY` = (optional) for AI-powered `/roast`
5. Deploy!

### Step 4 — Set Interactions URL
1. Copy your Vercel URL (e.g. `https://rosnitch.vercel.app`)
2. In Discord dev portal → your app → **General Information**
3. Paste `https://rosnitch.vercel.app/api/interactions` into **Interactions Endpoint URL**
4. Save ✅

### Step 5 — Register slash commands (one time)
```bash
DISCORD_TOKEN=xxx CLIENT_ID=xxx node register.js
```

---

## Optional: Growth Tracking
`/growth` requires free Upstash Redis:
1. Go to https://upstash.com → create free account
2. Create a Redis database
3. Add to Vercel env vars:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## Optional: AI Roasts
Get a free Anthropic API key at https://console.anthropic.com and add it as `ANTHROPIC_API_KEY`. Without it, `/roast` still works with pre-written roasts.

# Passion to Profit Coach

The production, self-hosted version of the Passion to Profit Coach — a free AI-guided
conversation that helps someone turn their passions and strengths into a business idea,
ending in a personalized, downloadable Roadmap PDF.

This replaces the Claude-artifact demo used for early testing. The core difference: your
Anthropic API key now lives safely on the server (`pages/api/coach.js`), never exposed in
the browser, and there's no dependency on visitors having a Claude.ai account.

## What's in this project

```
pages/
  index.js          <- the whole app: conversation, ready screen, report, PDF button
  api/coach.js       <- serverless function that calls Anthropic; holds the API key
  _app.js, _document.js
lib/
  coachScript.js     <- the coaching persona, all 5 stages, and report-generation prompts
  api.js             <- client-side helper that calls /api/coach, with retry/backoff
  generatePdf.js      <- builds the branded PDF using jsPDF
  logoData.js         <- your logo, embedded as base64 for the PDF
public/
  logo.svg            <- your logo, used directly on the web page
styles/
  globals.css          <- all the styling, carried over from the tested demo
```

## Step-by-step: getting this live

### 1. Get your files onto GitHub

1. Go to [github.com](https://github.com) and create a new repository (e.g. `passion-to-profit-coach`). Keep it private if you'd like — that's fine, Vercel can still deploy from a private repo.
2. On the new repo's page, use "uploading an existing file" (or drag-and-drop) to upload every file and folder from this project, keeping the same folder structure.
3. Commit the upload.

### 2. Import into Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New → Project**.
2. Choose **Import Git Repository** and select the repo you just created.
3. Vercel will auto-detect this as a Next.js project — you shouldn't need to change any build settings.
4. **Before clicking Deploy**, add your environment variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your real key from [console.anthropic.com](https://console.anthropic.com) (starts with `sk-ant-`)
5. Click **Deploy**.

Vercel will give you a live link like `passion-to-profit-coach.vercel.app` within a minute or two.

### 3. Test on that Vercel link first

Run all the way through — all five stages, the closing question, the name field, the
generated Roadmap, and the "Download Branded PDF" button — **before** touching your
GoDaddy domain at all. It's much easier to debug on the plain `.vercel.app` link than
after DNS is involved.

### 4. Connect your GoDaddy domain

1. In your Vercel project, go to **Settings → Domains** and add the domain or subdomain
   you want (e.g. `coach.budget4success.com` is simpler to set up than using your root
   domain directly).
2. Vercel will show you exactly which DNS record to add (usually a `CNAME`).
3. Log into GoDaddy, go to your domain's **DNS settings**, and add that record.
4. Wait for it to propagate — sometimes minutes, occasionally up to 24 hours.

### 5. Link it from your existing site

Add a button or link on your current GoDaddy site pointing to the new subdomain. This is
also a natural place to put your separate FloDesk signup form, entirely decoupled from
this tool.

## Local development (optional)

If you ever want to test changes on your own computer before deploying:

```
npm install
cp .env.example .env.local
# edit .env.local and paste in your real API key
npm run dev
```

Then open `http://localhost:3000`.

## Updating your API key later

If you ever need to rotate your key, go to your Vercel project → **Settings →
Environment Variables**, update `ANTHROPIC_API_KEY`, then redeploy (Vercel's dashboard
has a **Redeploy** button — no code changes needed).

## A note on cost

There's no monthly fee for any of this — Vercel's free tier comfortably covers this kind
of traffic, and the Anthropic API is pay-per-use. See the spend-cap guidance from your
setup conversation with Claude; a $20–25 monthly cap is a sensible starting point.

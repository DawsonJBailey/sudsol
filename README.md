# Meridian Turf Co. — React/Next.js Frontend Recreation

A fictional e-commerce frontend built to demonstrate a modern React/Next.js rebuild of a
WordPress + WooCommerce turfgrass e-commerce site's information architecture and UX patterns.

**This is an original, fictional brand.** The layout, page structure, and interaction patterns
are modeled after publicly-viewable e-commerce site conventions in the turfgrass industry, but
all copy, product names, and branding here are invented for this project — no real company's
content, images, or trademarks are used.

## Why this project exists

This was built as a technical demonstration piece: showing how an existing WordPress/WooCommerce
storefront's structure — category pages, product detail with variant/spec info, a blog/guides
section, and a cart — could be reimplemented as a modern, componentized React frontend with
TypeScript and Tailwind, while keeping the same core information architecture a non-technical
content team would recognize.

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS** with a custom design token set (see `tailwind.config.ts`)
- Client-side cart state via React Context + localStorage (no backend — this is a frontend-only
  demonstration; see the CommerceSync project for the backend/integration side of this kind of work)

## Pages

- `/` — Homepage (hero, category tiles, featured products, guide previews, newsletter)
- `/shop/[slug]` — Category listing (sod, seed, plugs)
- `/product/[slug]` — Product detail with spec table and growth-stage timeline
- `/guides` — Guide/blog listing
- `/guides/[slug]` — Individual guide article
- `/guides/pest-identification` — Lawn pest identification reference (7 common pests, original write-ups)
- `/pest-identifier` — AI-powered pest photo identifier (Claude vision) with linked product recommendations
- `/pest-control` — Pest treatment products
- `/cart` — Cart with quantity controls and subtotal
- `/checkout` — Shipping form + order summary (demo only, no real payment processing)
- `/order-confirmation` — Post-checkout confirmation with a generated order number
- `/contact` — Support contact form

## AI Pest Identifier

Uploads a photo to `/api/identify-pest`, which sends it to Claude (vision-capable model) with
a system prompt constraining classification to a fixed set of 7 known lawn pests. The response
is matched against `lib/pests.ts` and linked to a recommended treatment product.

Requires `ANTHROPIC_API_KEY` in `.env.local` — see the project setup guide.

**Note on content:** The pest identification write-ups are original, independently-written
descriptions of real, factual pest characteristics — not copied from any source. No third-party
images are used anywhere in this project.

## Running locally

```
npm install
npm run dev
```

Visit http://localhost:3000

## What's next

- Real payment processing (Stripe or similar) instead of the simulated checkout
- Account/order history pages
- Wiring the checkout flow through to a real order pipeline (see the companion
  CommerceSync project, which builds the backend/integration side of this same idea)
- Deploying to Vercel with a custom domain
# sudsol

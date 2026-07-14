# Meridian Turf Co. — System Design Document

A full-stack systems design reference for the Meridian Turf e-commerce storefront. Written as a
study document: each section explains **what** was built, **why it was designed that way**, **what
the alternatives were and their trade-offs**, and **how the design would scale**.

> Snapshot date: July 2026, mid-way through the Stripe → Shopify checkout migration (Shopify
> checkout is live; Stripe code is "parked" in comments for rollback).

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Tech Stack & Platform Decisions](#3-tech-stack--platform-decisions)
4. [Rendering & Caching Strategy](#4-rendering--caching-strategy)
5. [Product Catalog (Shopify Storefront API)](#5-product-catalog-shopify-storefront-api)
6. [Cart Architecture (the most interesting subsystem)](#6-cart-architecture)
7. [Checkout & Payments: the Stripe → Shopify Migration](#7-checkout--payments-the-stripe--shopify-migration)
8. [Orders & Order History](#8-orders--order-history)
9. [Authentication (Supabase)](#9-authentication-supabase)
10. [CRM & Marketing Automation (HubSpot)](#10-crm--marketing-automation-hubspot)
11. [Abandoned-Cart Recovery Pipeline](#11-abandoned-cart-recovery-pipeline)
12. [AI Lawn Assistant & Pest Identification](#12-ai-lawn-assistant--pest-identification)
13. [Search](#13-search)
14. [Security Model](#14-security-model)
15. [Failure Modes & Resilience](#15-failure-modes--resilience)
16. [Scaling Roadmap: 10x / 100x / 1000x](#16-scaling-roadmap-10x--100x--1000x)
17. [Known Limitations & Honest Critique](#17-known-limitations--honest-critique)
18. [Interview Talking Points](#18-interview-talking-points)

---

## 1. Product Overview

Meridian Turf Co. is a (fictional) direct-to-consumer turfgrass storefront:

- **Catalog**: sod, seed, and grass plugs (turf products) plus pest-control treatments, each with
  domain-specific specs (shade tolerance, mow height, growth stages, etc.).
- **Commerce**: cart, hosted checkout, order history.
- **Accounts**: email/password + Google OAuth sign-in, profile, per-user order history.
- **Content**: lawn-care guides, pest identification reference.
- **AI**: a chat widget that recommends products from the live catalog and identifies lawn pests
  from photos (Claude with tool use / vision).
- **Marketing**: newsletter signups and abandoned-cart recovery via HubSpot.

The defining architectural characteristic: **it is a thin, serverless "glue" application**. There
is almost no owned backend infrastructure. Every heavy subsystem is delegated to a SaaS that
specializes in it:

| Concern | Delegated to |
|---|---|
| Catalog, cart, checkout, payments, taxes, inventory, order management | Shopify |
| Authentication, user identity, relational data (legacy orders, cart shadow copies) | Supabase (Postgres + GoTrue) |
| CRM, email automation | HubSpot |
| LLM inference (chat, vision) | Anthropic API |
| Hosting, CDN, serverless compute, cron | Vercel |

This is a deliberate architectural stance worth defending in an interview: for a small commerce
business, **the highest-risk components (payments, auth, PII) are exactly the ones you should not
build yourself**. The app's job is orchestration, UX, and the one thing SaaS can't do for it — a
brand-specific storefront experience.

---

## 2. High-Level Architecture

```
                                   ┌──────────────────────────────────────────┐
                                   │                 Vercel                   │
                                   │                                          │
  ┌──────────┐   HTML/RSC/ISR      │  ┌────────────────────────────────────┐  │
  │          │◄────────────────────┼──│ Next.js 15 App Router              │  │
  │ Browser  │                     │  │  • Server Components (catalog,     │  │
  │          │                     │  │    orders, guides) — ISR cached    │  │
  │ ┌──────┐ │   JSON (API routes) │  │  • API routes:                     │  │
  │ │React │ │◄───────────────────►│  │     /api/lawn-assistant  ──────────┼──┼──► Anthropic API
  │ │client│ │                     │  │     /api/identify-pest   ──────────┼──┘      (Claude)
  │ │state │ │                     │  │     /api/newsletter-signup ────────┼─────► HubSpot CRM
  │ └──────┘ │                     │  │     /api/cron/abandoned-carts ─────┼─────► HubSpot CRM
  │          │                     │  │  • middleware.ts (session refresh) │  │        ▲
  └────┬─────┘                     │  └────────────────────────────────────┘  │        │
       │                          ┌┴──────────────┐                           │   Vercel Cron
       │                          │ Vercel Cron   │───► GET /api/cron/… ──────┘   (daily 09:00)
       │                          └───────────────┘
       │
       │  GraphQL (public Storefront token)          GraphQL/OAuth (server-only secrets)
       ├────────────────────────────────────┐        ┌──────────────────────────────┐
       ▼                                    ▼        ▼                              │
  ┌─────────────────────────────────────────────────────────┐                       │
  │                        Shopify                          │                       │
  │  • Storefront API: catalog reads, Cart API mutations    │                       │
  │  • Hosted checkout (browser redirects to checkoutUrl)   │                       │
  │  • Admin API (client-credentials): orders by email      │◄──────────────────────┘
  │  • Payments, taxes, inventory, receipts, fulfillment    │      (Next.js server only)
  └─────────────────────────────────────────────────────────┘
       │
       │  supabase-js (cookie-based sessions via @supabase/ssr)
       ▼
  ┌─────────────────────────────────────────────────────────┐
  │                       Supabase                          │
  │  • Auth (email/password, Google OAuth, PKCE)            │
  │  • Postgres: `orders` (legacy Stripe era),              │
  │              `carts`   (shadow copy for abandoned-cart) │
  └─────────────────────────────────────────────────────────┘
```

Three distinct trust zones:

1. **Browser** — holds only public tokens (Supabase publishable key, Shopify Storefront token).
   Talks directly to Shopify's Cart API and Supabase Auth.
2. **Next.js server (Vercel functions)** — holds secrets (`ANTHROPIC_API_KEY`,
   `HUBSPOT_ACCESS_TOKEN`, `SHOPIFY_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`).
   All privileged operations happen here. Modules that must never be bundled client-side import
   `server-only` so the build fails if they leak into a client component.
3. **Third-party SaaS** — each with its own auth model (see [Security Model](#14-security-model)).

---

## 3. Tech Stack & Platform Decisions

### Next.js 15 App Router (React Server Components)

**Why**: E-commerce is dominated by read-heavy, SEO-critical pages (category listings, product
detail). RSC + ISR gives statically-cached HTML per page with per-route revalidation windows,
without a separate API layer for page data — server components call `lib/shopify/catalog.ts`
directly.

**Alternatives & trade-offs**:

| Option | Trade-off |
|---|---|
| **SPA (Vite + React Router) + separate API** | Full client-side control, but poor SEO without extra SSR work, slower first paint, and you now own an API service. Wrong fit for a content/commerce site. |
| **Next.js Pages Router** | Mature, but `getStaticProps` forces page-level data fetching; App Router lets the layout fetch the search index while each page fetches its own data, with shared fetch-level caching. |
| **Remix** | Great data-loading model, but weaker static/ISR story at the time; the team's Vercel deployment makes Next the path of least resistance. |
| **Shopify Liquid theme / Hydrogen** | Would remove most of this codebase, but locks the frontend into Shopify's ecosystem. This project intentionally keeps a **headless** storefront so the commerce backend is swappable — proven by the fact that checkout migrated from Stripe to Shopify without rewriting the UI. |

### Serverless (Vercel functions) instead of a long-running server

**Why**: Traffic is bursty and low-volume; scale-to-zero pricing and zero ops. Every server
concern in this app is request-scoped (API proxying, page rendering) or cron-scoped.

**Trade-offs accepted**:
- No in-memory shared state across instances. Visible consequence: the Shopify Admin token cache
  in `lib/shopify/admin.ts` is *per-instance* — a cold start re-mints a token. Acceptable because
  minting is one cheap OAuth call and tokens live 24h.
- No WebSockets/long-lived connections (fine — nothing here needs them; the chat widget is
  request/response).
- Cron granularity and execution-time limits are platform-bound (Vercel Cron, function timeout).

### TypeScript everywhere

Shared types cross the client/server boundary safely: e.g. `CartItem` is defined in
`components/CartContext.tsx` and imported by the cron route to type the JSON stored in Supabase —
one shape, one definition, even though the data travels browser → Postgres → cron.

---

## 4. Rendering & Caching Strategy

This app is a good case study in **layered caching** — a favorite interview topic.

### The layers

```
Browser ──► Vercel CDN (ISR HTML) ──► Next.js Data Cache (fetch-level) ──► Shopify
                 revalidate: 300              revalidate: 300
```

1. **ISR (page level)** — `app/product/[slug]/page.tsx` and the root layout export
   `export const revalidate = 300`. Product pages are pre-rendered at build time via
   `generateStaticParams()` (which fetches all product handles from Shopify) and re-rendered in
   the background at most every 5 minutes. Visitors get CDN-cached HTML; catalog changes appear
   within ~5 minutes without a redeploy.

2. **Next.js Data Cache (fetch level)** — `storefrontFetch` in `lib/shopify/client.ts` passes
   `next: { revalidate: 300, tags: ["shopify"] }` to `fetch`. Multiple pages calling
   `getProducts()` within the window share one upstream Shopify request. The `"shopify"` cache
   tag exists so a future webhook handler could call `revalidateTag("shopify")` for **instant,
   event-driven invalidation** instead of waiting out the TTL.

3. **Cache bypass where staleness is unacceptable** — cart mutations pass `revalidate: false`
   (→ `cache: "no-store"`), and all Admin API calls are `no-store`. Carts and orders must never
   be stale or shared between users.

### Design decisions worth defending

- **Why TTL (300s) instead of webhooks-first?** A 5-minute stale window is harmless for a
  catalog (prices rarely change) and requires zero extra infrastructure. Webhook-driven
  `revalidateTag` is strictly better freshness but adds an endpoint, HMAC verification, and a
  failure mode (missed webhook = stale forever without a TTL backstop). The pragmatic production
  answer is **both**: keep the TTL as a backstop, add webhooks for instant invalidation. The
  cache tag was added now precisely to make that upgrade a one-liner later.

- **Build-time resilience**: `generateStaticParams` catches Shopify failures and returns `[]`,
  falling back to on-demand rendering. A missing env var or Shopify outage degrades the build to
  slower first-hits instead of failing the deploy. (Classic interview point: *static generation
  should be an optimization, not a hard dependency.*)

- **The AI assistant reuses the same cache**: when the model calls `recommend_products`, the tool
  handler calls `getProducts()` — hitting the same 5-minute fetch cache as the pages. The chatbot
  can never recommend a product that page rendering wouldn't also show.

### Scaling this layer

- 10x catalog size: `products(first: 50)` queries need cursor pagination; `generateStaticParams`
  should cap pre-rendered pages to bestsellers and let the long tail render on demand.
- 10x traffic: nothing changes — CDN absorbs it. That's the point of ISR.
- Personalization (e.g., logged-in pricing) would break full-page caching; you'd move
  personalized fragments to client components or use partial prerendering, keeping the static
  shell cached.

---

## 5. Product Catalog (Shopify Storefront API)

### Evolution: hardcoded fixture → headless CMS-of-record

The catalog began as a TypeScript array in `lib/data.ts` (still present, now serving as the
**seed fixture** and the source of shared types). It migrated to Shopify as system-of-record:

- `scripts/seed-shopify.ts` — an **idempotent** seed script: products matched by handle and
  updated in place, metafield definitions created only if missing, safe to re-run after editing
  the fixture. It also self-provisions its Storefront API token via the Admin API and writes it
  to `.env.local` (the store's plan lacks the Headless channel, so the script mints a classic
  storefront token instead — a nice example of working around platform constraints).
- `lib/shopify/catalog.ts` — anti-corruption layer: maps Shopify's GraphQL shape back into the
  app's original `Product` type (plus `variantId`, which the Cart API needs).

### Key design decisions

**Metafields for domain data.** Shopify's product model has no native "shade tolerance" or
"growth stages". Rather than abusing description HTML or tags, each spec is a namespaced
metafield (`meridian.shade_tolerance`, `meridian.stages` as JSON, …), fetched positionally with
`metafields(identifiers: [...])`. Trade-off: positional results return `null` per missing key, so
mappers null-check every entry; in exchange, the query is a single round-trip with no
over-fetching.

**One store, two product families.** Turf products and pest-control treatments share the store,
partitioned by `productType` with server-side query filters
(`product_type:sod OR product_type:seed OR product_type:plugs` vs `product_type:pest-control`).
Lookup-by-handle re-checks the type so a pest-control URL can't render on a turf product page.
Alternative — two stores or Shopify collections — was heavier than needed; `productType` is the
lightest partition that both listing queries and detail pages can enforce.

**Anti-corruption layer as migration insurance.** Because every page consumes `Product`, not
Shopify's node shape, the Shopify migration touched data-access code but not page components.
Same pattern made the Stripe→Shopify checkout swap survivable. *Interview framing: this is the
Ports & Adapters idea applied pragmatically — one mapping function per external shape, not a
framework.*

### Trade-offs vs alternatives for catalog storage

| Option | Why not |
|---|---|
| Keep hardcoded TS fixture | Zero latency and free, but non-technical staff can't edit; no inventory/pricing integration; every change is a deploy. |
| Own Postgres (Supabase) catalog | Full control, but now you own admin UI, image CDN, inventory sync — and checkout still needs the products to exist in the payment platform. |
| Headless CMS (Sanity/Contentful) + Stripe | Good editing UX, but product data would live in *two* systems (CMS for content, payment provider for SKUs) with a sync problem. Shopify holds both. |

---

## 6. Cart Architecture

The cart (`components/CartContext.tsx`) is the most intricate client-side subsystem and the best
distributed-systems story in the codebase. It maintains **four representations** of the same cart
and keeps them coherent:

| Copy | Where | Role |
|---|---|---|
| React state (`items`) | memory | **Rendering source of truth** — optimistic UI, instant |
| `localStorage` mirror | browser | Instant paint on reload before any network call |
| Shopify Cart object | Shopify | **The authority** — what checkout will actually charge |
| `carts` row | Supabase Postgres | Shadow copy for the abandoned-cart cron (signed-in users only) |

### Write path: optimistic UI + a serialized operation queue

Every mutation updates React state immediately (optimistic), then enqueues the corresponding
Shopify mutation onto a **promise-chain queue** (`opQueue`):

```
click "add"  ──► setItems(...)  (instant UI)
             └─► enqueue(cartLinesAdd / cartCreate)      ─┐
click "+"    ──► setItems(...)                            │ strictly ordered,
             └─► debounce 600ms ─► enqueue(cartLinesUpdate)│ one in flight at a time
click "remove" ─► setItems(...)                           │
             └─► enqueue(cartLinesRemove)                ─┘
```

Why each piece exists:

- **Serialized queue** (`opQueue.current = opQueue.current.then(op)`): Shopify cart mutations are
  not commutative — an "update quantity" for a line that hasn't been created yet fails. Ordering
  guarantees causality without needing versioning or CRDTs. This is the classic answer to
  *"how do you handle concurrent writes from rapid user input?"* — don't make them concurrent.
- **Debouncing** (600ms for Shopify quantity updates, 2s for the Supabase shadow write): rapid
  `+ + +` clicks collapse into one API call. Dirty-slug tracking (`dirtySlugs`) means only
  changed lines are sent.
- **Late binding of line IDs**: Shopify addresses cart lines by line ID, which the client only
  learns from mutation responses (`lineMapRef`: slug → line id). Queued ops read the map *inside*
  the op, after any in-flight add has resolved — avoiding a race where an update references a
  line that doesn't exist yet.
- **Failure = re-sync, not retry**: if a mutation fails, the queue's catch handler refetches the
  cart from Shopify and **overwrites local state with the server's truth**. Optimistic UI may
  briefly show a state that gets rolled back — chosen over a retry queue because a cart is
  low-stakes and reconvergence is simpler than exactly-once delivery.

### Read path: hydration hierarchy

On page load:
1. Paint instantly from `localStorage` (items lacking a `variantId` — pre-migration relics — are
   dropped, since they can't check out).
2. In the background, `cartGet(cartId)` re-hydrates from Shopify. If Shopify returns `null` (cart
   expired **or consumed by a completed checkout**), local state is cleared.

That second clause is elegant: **cart clearing after purchase requires no code path of its own.**
Shopify consumes the cart at checkout; next page load observes it gone and resets. No webhook, no
success-redirect handler, no `ClearCartOnSuccess` component (the old Stripe flow needed one — it's
now parked).

### Why client → Shopify directly, not via API routes?

The Storefront token is public by design (it's rate-limited, scoped to storefront operations, and
carries no privileged access). Calling Shopify from the browser removes a serverless hop per cart
click (latency + cost). Trade-off: cart logic lives in client code and can't be trusted — which is
fine, because **prices are never trusted from the client anyway**; checkout re-derives everything
from the server-side cart in Shopify.

### Alternatives considered

| Design | Trade-off |
|---|---|
| Server-side cart in Supabase, checkout builds Shopify cart at the end | One authority fewer, but every cart click hits your serverless function; abandoned checkout emails from Shopify wouldn't work; cart wouldn't survive into Shopify's ecosystem (discounts, scripts). |
| Shopify-only (no localStorage/React mirror) | Simplest coherence story, but every render blocks on network; empty flash on reload. |
| localStorage-only until checkout | The pre-migration design. No abandoned-cart data server-side, no line-level sync; building the Shopify cart at checkout time makes checkout latency spiky and can fail late. |

### Scaling notes

The cart scales *per user*, not with traffic (each user talks to Shopify directly). The scaling
concerns are: Storefront API rate limits (per-IP; fine for real users, needs bot protection),
and the `lines(first: 50)` cap — a 51-line cart would silently truncate the mirror (acceptable for
this product domain; would need pagination for a marketplace).

---

## 7. Checkout & Payments: the Stripe → Shopify Migration

The repo preserves both generations (Stripe code is commented out in "PARKED" blocks with restore
instructions), making it a rare side-by-side artifact of a real architectural migration.

### Generation 1: Stripe Elements (custom checkout)

```
Cart ─► /checkout (client) ─► POST /api/create-payment-intent
                                   │  server recomputes amount from catalog by slug
                                   │  (NEVER trusts client prices), min charge check,
                                   │  cart JSON stashed in PaymentIntent.metadata
                                   ▼
                              Stripe PaymentIntent ─► Elements form ─► redirect
                                   ▼
        /order-confirmation?payment_intent=… ─► server verifies PI status === "succeeded"
                                   ─► idempotent insert into Supabase `orders`
                                      (unique on stripe_payment_intent_id)
                                   ─► clear `carts` row + HubSpot abandoned flag
```

Security properties worth quoting in interviews:
- **Server-side price authority**: client sends only `{slug, quantity}`; the server prices the
  cart from its own catalog. A tampered client can't buy sod for $0.01.
- **Idempotent order recording**: confirmation page can be refreshed/replayed; the unique
  constraint on `stripe_payment_intent_id` plus a read-after-conflict fallback makes recording
  exactly-once-ish. (Weakness: recording on *page visit* rather than a Stripe webhook means a
  user who never returns from the redirect produces a paid-but-unrecorded order. A webhook would
  fix this — one reason the migration was attractive.)

### Generation 2: Shopify hosted checkout (current)

```
Cart page ─► prepareCheckout():
               flush debounced quantity updates ─► await opQueue (all writes durable)
               ─► cartBuyerIdentityUpdate(email)   (best-effort: prefill + order matching)
               ─► window.location.assign(cart.checkoutUrl)   → Shopify owns everything after
```

`/checkout` and `/order-confirmation` remain as thin redirect/landing stubs so old links don't 404,
and `/api/create-payment-intent` returns **HTTP 410 Gone** — a deliberate, correct status for a
retired endpoint.

### The trade-off table (a genuinely balanced decision)

| Dimension | Stripe custom checkout | Shopify hosted checkout |
|---|---|---|
| UX control / branding | Full — checkout matches the site | Limited — Shopify's page, cross-domain redirect |
| PCI scope | SAQ-A via Elements iframes, but *you* run the checkout page | Essentially zero — never touch payment UI |
| Taxes, shipping rates, address validation | Build or integrate yourself | Included |
| Inventory decrement, receipts, refunds, fraud review | Build yourself (webhooks + admin UI) | Included |
| Order data ownership | First-party (your Postgres) | In Shopify; you query it back via Admin API |
| Conversion | You own (and must optimize) the funnel | Shopify's heavily-optimized checkout, Shop Pay |
| Failure surface | Your code between "paid" and "recorded" | Shopify's problem |

The deciding argument: with Stripe, the app owned the **hardest correctness problem in
e-commerce** — the money-moved-but-state-didn't gap — with no webhook infrastructure. Shopify
absorbs that whole class of bugs. Cost: order history now depends on a cross-system join (next
section), and the checkout page no longer matches the brand.

**Rollback strategy**: parked code + env vars still present means reverting is an uncomment, not
a rewrite. Keeping a proven fallback during a migration window is deliberate risk management
(the memory-noted remaining step is a full Bogus-Gateway click-through verification).

---

## 8. Orders & Order History

`lib/orders.ts` → `getOrdersForCurrentUser()` merges two systems of record:

1. **Legacy Stripe-era orders** from Supabase `orders` (keyed `user_id`).
2. **Shopify orders**, fetched via Admin API `orders(query: "email:...")` — matched by the
   signed-in user's email.

Both are normalized into a provider-agnostic `DisplayOrder` shape, merged, and sorted by date.
The two fetches run in `Promise.all`, and each degrades independently: a Shopify Admin failure
logs and returns `[]` rather than 500ing the page.

### Design notes & trade-offs

- **Email as the join key** is the pragmatic hack of the design. There's no shared customer ID
  between Supabase and Shopify, and the buyer types their email at Shopify's checkout. The app
  improves match probability by stamping `cartBuyerIdentityUpdate(email)` before redirecting.
  Weaknesses: user checks out with a different email → order invisible; email is interpolated
  into a Shopify search query (mitigated by stripping quotes/backslashes). The robust fix is
  Shopify **Customer Accounts API** or storing the Shopify customer ID against the Supabase user —
  noted as the scaling path.
- **Admin API access model**: OAuth **client-credentials** grant (the only mechanism for Dev
  Dashboard apps since Jan 2026); 24h tokens cached per server instance and re-minted 60s before
  expiry. Requires `read_orders` + protected-customer-data approval; without `read_all_orders`
  Shopify only returns the last 60 days — a real product limitation documented in code.
- **Why not mirror Shopify orders into Supabase via webhooks?** That's the 10x answer (fast
  queries, no 60-day cap, no per-page-view Admin API calls). At current scale, querying live
  avoids a sync pipeline and its consistency bugs. Classic build-when-needed call.

---

## 9. Authentication (Supabase)

### Flow architecture (`@supabase/ssr`, cookie-based sessions)

Three client factories, one per execution context — this trio is the canonical Supabase/Next.js
pattern and a good thing to be able to explain:

| Factory | Context | Cookie capability |
|---|---|---|
| `utils/supabase/client.ts` | Browser components | Reads/writes via document cookies |
| `utils/supabase/server.ts` | Server components / route handlers | Reads always; writes only outside RSC render (the `try/catch` around `setAll`) |
| `utils/supabase/middleware.ts` | Edge middleware | The only place that can *refresh* an expired session and set cookies on both request and response |

`middleware.ts` runs `supabase.auth.getUser()` on every non-static request. That call is not
decorative: it **refreshes expired JWTs and rewrites the session cookies**. Skip it and auth
state silently goes stale in server components (the code comments call this out). The matcher
excludes `_next/static`, images, etc., so the token refresh doesn't tax asset requests.

### Sign-in surface

- Email/password with client-side password-strength gating (`PasswordStrengthMeter`,
  score ≥ 3 required) and email confirmation (`emailRedirectTo` → `/auth/callback`).
- Google OAuth (PKCE): `/auth/callback` exchanges `?code=` for a session via
  `exchangeCodeForSession`, then redirects; failures land on `/login?error=auth_failed`.
- User metadata (name, E.164-ish phone assembled from a country-code selector) stored in
  Supabase `auth.users.user_metadata` at signup — no separate `profiles` table yet, which is fine
  until other users need to see each other's names.

### Why Supabase over the alternatives

| Option | Trade-off |
|---|---|
| **NextAuth/Auth.js** | Free, flexible, but sessions-only — you still need a database and user tables; email confirmation flows are DIY. |
| **Clerk/Auth0** | Polished, but per-MAU pricing and *another* vendor; Supabase was already in the stack for Postgres. |
| **Shopify customer accounts** | Would unify commerce identity, but couples every non-commerce feature (chat history, future features) to Shopify, and headless customer-account support was historically awkward. |
| **Roll your own** | Never the right answer for password storage in a project this size. |

The strongest argument is consolidation: **auth and the relational database are one vendor, one
SDK, and RLS policies can reference `auth.uid()` directly** (the `carts` table is per-user data
written from the browser — exactly the shape RLS is built for, with the service-role client
reserved for the cron's cross-user reads).

---

## 10. CRM & Marketing Automation (HubSpot)

`lib/hubspot.ts` is intentionally tiny: one function, `upsertHubSpotContact`, wrapping HubSpot's
**batch upsert endpoint** keyed on email. The comment documents the why: the naive
create-then-409-then-patch dance is two round-trips and a race; upsert is one idempotent call.
Idempotency-by-design shows up again here — the whole marketing integration is safe to retry.

Consumers:
- `/api/newsletter-signup`: validates email server-side (regex + normalization), upserts contact
  with `lifecyclestage: subscriber`. The API route exists because the HubSpot token is a server
  secret — the form can't call HubSpot directly.
- The abandoned-cart cron (next section) sets `cart_abandoned_at` / `abandoned_cart_summary`
  custom properties; HubSpot **workflows** (configured in HubSpot, not code) send the actual
  emails.

**Design stance**: the app writes *facts* into the CRM ("this contact abandoned a cart containing
X at time T"); the CRM owns *policy* (when to email, copy, suppression rules). That separation
means marketing iterates on email sequences without deploys. The alternative — sending email
directly from the app via Resend/SES — is fewer vendors but re-implements suppression,
unsubscribe compliance, and sequencing that CRMs already do.

---

## 11. Abandoned-Cart Recovery Pipeline

The full pipeline stitches together four systems:

```
Browser cart change (signed-in user)
  └─ debounced 2s ─► upsert Supabase `carts` { user_id, items JSONB, updated_at,
                                               hubspot_synced_at: null }   ← reset on every change
Vercel Cron (daily 09:00 UTC)
  └─► GET /api/cron/abandoned-carts   (Authorization: Bearer CRON_SECRET)
        └─ query: hubspot_synced_at IS NULL AND updated_at < now()-60min AND items != []
             └─ for each: look up email (admin.getUserById)
                          upsert HubSpot contact {cart_abandoned_at, abandoned_cart_summary}
                          mark hubspot_synced_at        ← the "processed" flag
HubSpot workflow (external) ─► sends the recovery email
Purchase completes ─► (Stripe era: delete cart row + blank the HubSpot flags — currently parked)
                      (Shopify era: cart consumed; next hydration clears local state)
```

### The interesting design details

- **Why a shadow copy in Postgres at all?** The cart's authorities (localStorage, Shopify cart)
  are invisible to a cron job — localStorage is in the browser, and Shopify carts aren't queryable
  by "user with items who went quiet". A queryable server-side mirror is the minimal bridge. This
  is a general pattern: *to run batch jobs over client state, you must first make that state
  observable server-side.*
- **`hubspot_synced_at` as a dedup flag**: it's set after a successful HubSpot write and **reset
  to `null` on every cart change**. Net effect: one notification per distinct abandoned cart
  contents, and a changed cart re-arms the trigger. Set-after-write ordering means a crash
  between the two writes causes a duplicate upsert, not a lost one — and the upsert is idempotent
  anyway. (At-least-once + idempotent consumer = the textbook combination.)
- **Cron vs event-driven**: polling Postgres once a day is trivially debuggable and cheap at this
  scale. Git history shows it was *hourly*, then deliberately reduced to daily — a real tuning
  decision (recovery emails aren't latency-sensitive; fewer HubSpot writes, fewer invocations).
  At 100x, this becomes a Supabase `pg_cron` job or a queue fed by cart-update events, and the
  per-cart serial loop (N+1 `getUserById` calls, sequential HubSpot writes) becomes a batched
  join + concurrent writes with rate limiting.
- **Auth**: the route is publicly reachable, so it demands `Authorization: Bearer CRON_SECRET`
  (Vercel Cron injects it). Without this, anyone could trigger mass HubSpot writes.
- **Known gap**: guest carts are invisible (no `user_id`) — abandoned-cart recovery only covers
  signed-in users. Shopify's own abandoned-*checkout* emails partially cover the gap post-redirect.

---

## 12. AI Lawn Assistant & Pest Identification

A floating chat widget (`components/LawnAssistant.tsx`) backed by `/api/lawn-assistant`, which
proxies Claude (`claude-sonnet-5`) with **two tools**. This is a textbook grounded-LLM design and
the section most worth studying for "how do you productionize an LLM feature?" questions.

### Architecture

```
Widget (client)                    /api/lawn-assistant (server)                Anthropic
  full transcript ───────────────►  validate + map messages ────────────────►  Claude
  (incl. base64 image)              tool loop (max 4 rounds):
                                      recommend_products ─► getProducts()      stop_reason:
                                        └─ recommendProducts() deterministic     tool_use ─┐
                                      identify_pest ─► pests fixture lookup               │
                                    append tool_result, call again  ◄──────────────────────┘
  reply + structured products/pest ◄─ final text + side-channel data
  rendered as product cards
```

### The grounding design (the important part)

The system prompt forbids the model from naming any product, price, spec, pest, or treatment that
didn't come back from a tool. The tools guarantee it structurally:

- `recommend_products`: the model only extracts **preferences** (sun/traffic/maintenance/goal as
  enums). The actual selection is `recommendProducts()` — a **deterministic filter over the live
  Shopify catalog** where every exclusion is grounded in an explicit spec field. The LLM cannot
  hallucinate a product because it never generates products; it generates *filter arguments*.
- `identify_pest`: vision classification constrained to a **closed enum** of known pest slugs
  (plus `"unknown"`), then treatment data comes from the fixture lookup, not the model.

The API response carries the structured `products` / `pest` / `controlProduct` **out-of-band**
alongside the prose reply, so the UI renders real product cards with real links/prices — the
model's text is decoration around verified data.

*Interview framing*: this is the general recipe for trustworthy LLM features —
**LLM for intent extraction and language, deterministic code for facts, closed enums at the
boundary, and structured data flowing around (not through) the model's prose.*

### Other production details

- **Server-side proxy**: `ANTHROPIC_API_KEY` never reaches the browser; the route also caps
  `max_tokens: 600` and tool rounds (4) to bound cost and latency per request.
- **Image validation by magic bytes** (`lib/image.ts`): the client's claimed MIME type is
  ignored; the server sniffs JPEG/PNG/GIF/WebP signatures from the actual bytes. Comment in code:
  browsers derive `file.type` from the extension, which lies.
- **Stateless conversation**: the client resends the full transcript each turn. No chat storage,
  no session affinity — perfect for serverless. Trade-off: token cost grows with conversation
  length (fine for short shopping chats; a support bot would need summarization/truncation).
- **Evolution visible in git**: a standalone `/pest-identifier` page + `/api/identify-pest`
  (strict-JSON single-shot classifier) came first; pest ID was then folded into the chat widget
  as a tool. The old endpoint remains — flagged in [§17](#17-known-limitations--honest-critique)
  as consolidation debt.
- **What's missing for scale**: streaming (SSE) for perceived latency, per-IP rate limiting
  (currently anyone can burn Anthropic budget), prompt caching for the static system prompt, and
  observability on tool-call outcomes.

---

## 13. Search

Deliberately the simplest thing that works: the root layout fetches all products (same cached
`getProducts()`), passes `{slug, name, tagline}` down to the header, and `SearchBar` does
client-side substring matching over products + guides, capped at 8 results.

**Why this is correct here**: the corpus is ~a dozen items and already in memory; zero latency,
zero infra. **When it breaks**: catalog beyond a few hundred items (payload size in every page's
RSC props), or the need for typo tolerance/ranking/facets. Scaling ladder: Shopify Predictive
Search API → a search service (Algolia/Meilisearch/Typesense) fed by product webhooks. Also note
the layout catches catalog failures so search degrades to guides-only instead of 500ing every
page.

---

## 14. Security Model

### Secret tiering (the token table)

| Credential | Exposure | Why that's safe |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Anon role; every query subject to RLS policies |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | Browser | Public-by-design, storefront-scoped, rate-limited |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (`lib/supabase-admin.ts`) | Bypasses RLS — used only by the cron |
| `SHOPIFY_CLIENT_ID`/`SECRET` | Server only | Mint 24h Admin tokens (orders, protected customer data) |
| `HUBSPOT_ACCESS_TOKEN`, `ANTHROPIC_API_KEY` | Server only | Proxied via API routes |
| `CRON_SECRET` | Vercel ↔ cron route | Bearer check gates the only "job trigger" endpoint |

Enforcement is structural, not just conventional: server-secret modules import **`server-only`**,
so accidentally importing `lib/hubspot.ts` into a client component is a build error, not a leak.

### Application-level protections

- **Price integrity**: never trust the client. Stripe era: server re-priced carts from the
  catalog. Shopify era: checkout reads the server-side Shopify cart; the localStorage mirror is
  display-only.
- **Payment truth**: order recording verified `paymentIntent.status === "succeeded"` server-side —
  a success *redirect* is not proof of payment.
- **Injection surfaces**: email is regex-validated + normalized before HubSpot; quotes/backslashes
  stripped before interpolation into the Shopify orders search query; uploaded images validated by
  magic bytes; chat request shape validated before proxying.
- **LLM safety**: closed-enum tools + "never state facts that didn't come from a tool" bound both
  hallucination and prompt-injection blast radius (a hostile prompt can't make the bot invent
  prices — worst case it calls a harmless catalog filter).
- **Auth session integrity**: middleware-based token refresh; OAuth via PKCE code exchange.

### Gaps to name proactively (better to volunteer these in an interview)

No rate limiting on the AI endpoints (cost DoS), no CSRF tokens on JSON POSTs (low risk given no
cookie-authenticated state-changing POSTs, but worth stating), Supabase RLS policies live outside
the repo (unauditable here), and the cron's bearer comparison is a plain string compare.

---

## 15. Failure Modes & Resilience

A recurring theme: **every third-party dependency has an explicit degradation path.**

| Failure | Blast radius | Mechanism |
|---|---|---|
| Shopify down at build time | Slower first page loads, deploy still succeeds | `generateStaticParams` catch → on-demand rendering |
| Shopify down at runtime (catalog) | Search empty; ISR keeps serving last-good HTML until revalidation succeeds | layout try/catch; stale-while-revalidate semantics |
| Shopify cart mutation fails | One user's cart briefly wrong, then reconverges | queue catch → `cartGet` re-sync, server wins |
| Shopify Admin (orders) fails | Order page shows legacy orders only | per-source catch in `Promise.all` |
| HubSpot fails during cron | Cart skipped, retried next run | `hubspot_synced_at` stays null; counters reported |
| Anthropic fails | Chat shows a friendly error bubble | route 502 → widget error message |
| Cart line lost between systems | Old pre-migration items dropped on load | `variantId` filter at hydration |
| Duplicate order recording (Stripe era) | None | unique PI id + read-after-conflict fallback |

Patterns to name: graceful degradation per dependency, idempotency + at-least-once instead of
exactly-once, server-authoritative reconciliation instead of client retry, stale-while-revalidate
as an availability tool (not just performance).

What's *missing*: retries with backoff (most failures are "log and degrade"), circuit breakers,
structured observability (only `console.error` → Vercel logs), and alerting on cron failures.
Right-sized for the scale, but the interview answer for "what would you add first in production"
is: **error tracking (Sentry) + a dead-letter/alert on the cron**.

---

## 16. Scaling Roadmap: 10x / 100x / 1000x

### 10x (a real small business: ~10k users, hundreds of orders/day)

- **Event-driven cache invalidation**: Shopify `products/update` webhook → verify HMAC →
  `revalidateTag("shopify")`. TTL stays as backstop. (The cache tag already exists for this.)
- **Order mirroring**: Shopify `orders/create` webhook → insert into Supabase keyed by Shopify
  customer/user link. Kills the per-page-view Admin API query, the 60-day window, and the
  email-join fragility in one move.
- **Rate limiting** on `/api/lawn-assistant` (per-IP token bucket via Upstash/Vercel KV) — the
  only endpoint where an attacker directly spends your money.
- **Streaming** the assistant (SSE) and Anthropic prompt caching for the static system prompt.
- **Observability**: Sentry, structured logs, cron success metrics + alerting.

### 100x (mid-market: catalog in the thousands, orders in the thousands/day)

- **Catalog**: cursor pagination everywhere; pre-render only top sellers; move search to a
  dedicated engine fed by webhooks (Algolia/Meilisearch) with facets and typo tolerance.
- **Abandoned-cart pipeline**: replace poll-the-table with events — cart-update → queue
  (e.g. Supabase pg_cron enqueue or QStash) → worker with batched HubSpot writes and per-tenant
  rate limiting. The `hubspot_synced_at` idempotency design carries over unchanged.
- **Identity unification**: store the Shopify customer ID on the Supabase user at first order;
  stop joining by raw email.
- **AI**: conversation summarization/truncation, response caching for common questions,
  model-tiering (Haiku-class model for intent extraction, larger model only when needed).
- **Regionalization**: Vercel is already edge-global and Shopify's CDN is global; Supabase is
  single-region — acceptable because it's off the hot path (auth token refresh + cron only).
  If auth latency mattered, add read replicas.

### 1000x (platform scale) — mostly a *different business*, but directionally:

- Headless commerce re-evaluation: Shopify Plus checkout extensibility, or unbundling again
  (dedicated OMS, payment orchestration across PSPs).
- CQRS-style split: all reads from owned, webhook-fed projections (Postgres/search index);
  third-party APIs only on the write path.
- The cart's client-side op queue would be re-homed server-side (or into Shopify entirely) to
  support multi-device carts merged by customer identity.
- Dedicated data pipeline (CDC from Postgres + webhook firehose → warehouse) replacing point
  integrations like the HubSpot property writes.

The honest meta-answer: the current architecture's SaaS-heavy shape means **10x and 100x are
mostly configuration and a few webhooks, not rewrites** — that's what buying instead of building
purchases.

---

## 17. Known Limitations & Honest Critique

Interviewers respect self-awareness. Real issues in the current code:

1. **Order↔user join by email** — fragile (different checkout email = invisible order) and
   limited to 60 days by Admin API scope. Fix: webhook mirror + stored customer ID.
2. **Guest carts invisible to abandoned-cart recovery** — the Supabase shadow copy only exists
   for signed-in users.
3. **No automated tests** — the cart's op-queue/debounce logic is exactly the kind of concurrency
   code that regresses silently; it's the first thing that deserves unit tests (fake timers +
   mocked Shopify client).
4. **No rate limiting / abuse control on AI endpoints** — direct cost exposure.
5. **Duplicated AI surface** — `/api/identify-pest` + `/pest-identifier` predate the chat-widget
   tool and should be consolidated or deleted (dead-ish code with a live API key behind it).
6. **`lib/data.ts` dual role** — seed fixture *and* live source for guides/types. The assistant's
   pest fixture (`lib/pests.ts`) is local while control-product *prices* come from Shopify on the
   pest pages; the chat's treatment info can drift from the store.
7. **Dead weight from the migration** — Stripe deps still installed, parked code blocks, unused
   `CheckoutForm`/`ClearCartOnSuccess`. Deliberate during the rollback window; needs a cleanup
   date so "parked" doesn't become "permanent".
8. **Search index in every page payload** — fine now, a payload tax as the catalog grows.
9. **RLS policies and DB schema not in the repo** — the `orders`/`carts` schemas exist only in
   Supabase; migrations-as-code (supabase CLI) would make the data layer reviewable.

---

## 18. Interview Talking Points

Condensed narratives this codebase lets you tell first-hand:

1. **Build vs. buy, argued concretely** — payments, auth, CRM, and inference are all bought;
   the trade-off table in §7 is a complete worked example with a real migration between the two
   sides of it.
2. **A real migration story** — Stripe → Shopify with a strangler-fig flavor: anti-corruption
   layers kept pages stable, old endpoints return 410, parked code is the rollback plan, and the
   last mile (checkout click-through verification) is tracked.
3. **Distributed state coherence** — four cart representations, one authority, optimistic UI,
   a serialized op queue for non-commutative mutations, debounced writes, and
   reconcile-from-server on failure. This maps directly to classic "design a collaborative
   cart/doc" questions.
4. **Idempotency everywhere** — seed script (match-by-handle), order recording (unique PI id),
   HubSpot upsert, cron dedup flag. At-least-once delivery + idempotent consumers as the default
   posture.
5. **Layered caching with an invalidation story** — CDN/ISR + fetch cache + tags, TTL as
   backstop, webhooks as the planned upgrade, `no-store` where staleness is dangerous.
6. **Grounded LLM product design** — intent extraction vs. fact generation, closed enums,
   deterministic filters over live data, structured side-channel responses, server-proxied keys,
   magic-byte input validation, bounded tool loops.
7. **Batch pipelines over client state** — the shadow-copy pattern: client state must be made
   server-observable before a cron can act on it; processed-flags reset on change.
8. **Security tiering** — public-by-design tokens vs. server secrets, `server-only` as structural
   enforcement, server-side price authority, and the humility to list the gaps (§14, §17).

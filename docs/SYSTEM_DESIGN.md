# Meridian Turf Co. — System Design Document

A full-stack systems design reference for the Meridian Turf e-commerce storefront. Written as a
study document: each section explains **what** was built, **why it was designed that way**, **what
the alternatives were and their trade-offs**, and **how the design would scale**.

> Snapshot date: July 2026, after going **all-in on Shopify**: hosted checkout, passwordless
> customer auth (Customer Account API), orders/profile/marketing all Shopify-native. Supabase,
> HubSpot, and Stripe have been removed from this codebase entirely. The pre-Shopify
> implementation (Stripe Elements checkout + Supabase auth) is preserved as a separate project on
> the `stripe-legacy` branch of a sibling fork — the two generations remain comparable side by side.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Tech Stack & Platform Decisions](#3-tech-stack--platform-decisions)
4. [Rendering & Caching Strategy](#4-rendering--caching-strategy)
5. [Product Catalog (Shopify Storefront API)](#5-product-catalog-shopify-storefront-api)
6. [Cart Architecture (the most interesting subsystem)](#6-cart-architecture)
7. [Checkout & Payments: Two Migrations](#7-checkout--payments-two-migrations)
8. [Orders & Order History](#8-orders--order-history)
9. [Authentication (Shopify Customer Account API)](#9-authentication-shopify-customer-account-api)
10. [Email Marketing (Shopify-native)](#10-email-marketing-shopify-native)
11. [Abandoned-Checkout Recovery](#11-abandoned-checkout-recovery)
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
- **Commerce**: cart, hosted checkout, order history with links to Shopify's order-status pages.
- **Accounts**: passwordless sign-in (email → one-time code) via Shopify customer accounts;
  profile editing; per-customer order history.
- **Content**: lawn-care guides, pest identification reference.
- **AI**: a chat widget that recommends products from the live catalog and identifies lawn pests
  from photos (Claude with tool use / vision).
- **Marketing**: newsletter signups (email-marketing consent on Shopify customers) and Shopify's
  native abandoned-checkout recovery emails.

The defining architectural characteristic: **it is a thin, serverless "glue" application** — and
after the second migration, a remarkably *consolidated* one. Every commerce-adjacent concern now
lives in a single vendor:

| Concern | Delegated to |
|---|---|
| Catalog, cart, checkout, payments, taxes, inventory, order management | Shopify |
| Authentication, customer identity, profiles | Shopify (Customer Account API) |
| Email marketing (subscribers, abandoned-checkout emails) | Shopify (Email + Marketing Automations) |
| LLM inference (chat, vision) | Anthropic API |
| Hosting, CDN, serverless compute | Vercel |

This is a deliberate architectural stance worth defending in an interview: for a small commerce
business, **the highest-risk components (payments, auth, PII) are exactly the ones you should not
build yourself** — and once Shopify holds the catalog and checkout, holding identity and marketing
there too eliminates the cross-system joins that were this app's most fragile seams (see §8/§9
history notes). The app's job is orchestration, UX, and the one thing SaaS can't do for it — a
brand-specific storefront experience.

---

## 2. High-Level Architecture

```
                                   ┌──────────────────────────────────────────────┐
                                   │                    Vercel                    │
                                   │                                              │
  ┌──────────┐   HTML/RSC/ISR      │  ┌────────────────────────────────────────┐  │
  │          │◄────────────────────┼──│ Next.js 15 App Router                  │  │
  │ Browser  │                     │  │  • Server Components (catalog, orders, │  │
  │          │                     │  │    profile, guides) — ISR or dynamic   │  │
  │ ┌──────┐ │   JSON (API routes) │  │  • API routes:                         │  │
  │ │React │ │◄───────────────────►│  │     /api/lawn-assistant ───────────────┼──┼──► Anthropic API
  │ │client│ │                     │  │     /api/identify-pest  ───────────────┼──┘      (Claude)
  │ │state │ │                     │  │     /api/newsletter-signup ─► Admin API│
  │ └──────┘ │                     │  │     /api/auth/me        (session peek) │
  │          │                     │  │     /api/cart/attach-buyer             │
  └────┬─────┘                     │  │  • Auth routes (OAuth/PKCE):           │
       │                          │  │     /auth/login → authorize redirect    │
       │                          │  │     /auth/callback → token exchange     │
       │                          │  │     /auth/logout → end session          │
       │                          │  └────────────────────────────────────────┘  │
       │                          └──────────────────────────────────────────────┘
       │
       │  GraphQL (public Storefront token)     server-only: Admin API (client credentials),
       │  browser ↔ Shopify Cart API            Customer Account API (customer token from
       │                                        httpOnly cookies), token exchanges
       ▼
  ┌────────────────────────────────────────────────────────────────────┐
  │                              Shopify                               │
  │  • Storefront API: catalog reads, Cart API mutations               │
  │  • Hosted checkout (browser redirects to checkoutUrl)              │
  │  • Customer Account API: OAuth (openid/PKCE), profile, orders      │
  │  • Admin API (client credentials): newsletter consent writes       │
  │  • Email + Marketing Automations: subscribers, abandoned checkout  │
  │  • Payments, taxes, inventory, receipts, fulfillment               │
  └────────────────────────────────────────────────────────────────────┘
```

Three distinct trust zones:

1. **Browser** — holds only the public Storefront token; talks directly to Shopify's Cart API.
   Customer auth tokens never reach browser JavaScript — they live in httpOnly cookies and are
   used only by the Next.js server.
2. **Next.js server (Vercel functions)** — holds secrets (`ANTHROPIC_API_KEY`,
   `SHOPIFY_CLIENT_SECRET`) and the per-user customer tokens (from cookies). All privileged
   operations happen here. Modules that must never be bundled client-side import `server-only`
   so the build fails if they leak into a client component.
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
| **Shopify Liquid theme / Hydrogen** | Would remove most of this codebase, but locks the frontend into Shopify's ecosystem. This project intentionally keeps a **headless** storefront so the commerce backend is swappable — proven by the fact that checkout migrated from Stripe to Shopify (and auth from Supabase to Shopify) without rewriting the page components. |

### Serverless (Vercel functions) instead of a long-running server

**Why**: Traffic is bursty and low-volume; scale-to-zero pricing and zero ops. Every server
concern in this app is request-scoped (API proxying, page rendering, OAuth exchanges).

**Trade-offs accepted**:
- No in-memory shared state across instances. Visible consequences: the Shopify Admin token cache
  in `lib/shopify/admin.ts` and the OIDC discovery cache in `lib/shopify/customer.ts` are
  *per-instance* — a cold start re-mints/re-fetches. Acceptable because both are one cheap call
  (Admin tokens live 24h; discovery documents are effectively static).
- No WebSockets/long-lived connections (fine — nothing here needs them; the chat widget is
  request/response).
- Session refresh must be **lazy** (performed inside request handlers when a token has expired)
  rather than by a background job — see §9.

### TypeScript everywhere

Shared types cross subsystem boundaries safely: e.g. `CustomerOrder` is defined once in
`lib/shopify/customer.ts` and consumed by the orders page; `Product` is defined in `lib/data.ts`
and every page renders it regardless of which backend produced it.

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
   (→ `cache: "no-store"`); all Admin API and Customer Account API calls are `no-store`; the
   orders and profile pages are `dynamic = "force-dynamic"` (per-user data behind auth cookies
   must never be cached or shared).

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
  the fixture. It publishes products to every sales channel, including the Headless channel
  whose public token the app uses for Storefront API access. (Historical note: on the original
  trial store the Headless channel wasn't available, so the script self-provisioned a classic
  storefront token via the Admin API — that fallback path is still in the script, gated on the
  env var being empty.)
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
The same pattern made both the Stripe→Shopify checkout swap and the Supabase→Shopify auth swap
survivable. *Interview framing: this is the Ports & Adapters idea applied pragmatically — one
mapping function per external shape, not a framework.*

### Trade-offs vs alternatives for catalog storage

| Option | Why not |
|---|---|
| Keep hardcoded TS fixture | Zero latency and free, but non-technical staff can't edit; no inventory/pricing integration; every change is a deploy. |
| Own Postgres catalog | Full control, but now you own admin UI, image CDN, inventory sync — and checkout still needs the products to exist in the payment platform. |
| Headless CMS (Sanity/Contentful) + payment provider | Good editing UX, but product data would live in *two* systems (CMS for content, payment provider for SKUs) with a sync problem. Shopify holds both. |

---

## 6. Cart Architecture

The cart (`components/CartContext.tsx`) is the most intricate client-side subsystem and the best
distributed-systems story in the codebase. It maintains **three representations** of the same
cart and keeps them coherent:

| Copy | Where | Role |
|---|---|---|
| React state (`items`) | memory | **Rendering source of truth** — optimistic UI, instant |
| `localStorage` mirror (+ cart ID) | browser | Instant paint on reload before any network call |
| Shopify Cart object | Shopify | **The authority** — what checkout will actually charge |

(A fourth copy — a Supabase "shadow" row per signed-in user — existed solely to make cart state
queryable by the old abandoned-cart cron. It was deleted along with that pipeline; see §11 for
what replaced it and what that pattern was for.)

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
- **Debouncing** (600ms for quantity updates): rapid `+ + +` clicks collapse into one API call.
  Dirty-slug tracking (`dirtySlugs`) means only changed lines are sent.
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
success-redirect handler.

### The checkout handoff: attaching the customer server-side

`prepareCheckout()` flushes pending writes, awaits the queue, then POSTs the cart ID to
`/api/cart/attach-buyer`. That route reads the customer's access token from httpOnly cookies and
runs `cartBuyerIdentityUpdate(customerAccessToken)` **server-side** — the token never reaches
browser JavaScript. The result: Shopify's hosted checkout opens *already signed in* (saved
addresses, Shop Pay, prefilled contact). Signed out, the route is a no-op and checkout proceeds
as guest. This is the same mechanism Hydrogen (Shopify's own headless framework) uses.

### Why client → Shopify directly, not via API routes?

The Storefront token is public by design (it's rate-limited, scoped to storefront operations, and
carries no privileged access). Calling Shopify from the browser removes a serverless hop per cart
click (latency + cost). Trade-off: cart logic lives in client code and can't be trusted — which is
fine, because **prices are never trusted from the client anyway**; checkout re-derives everything
from the server-side cart in Shopify. The one privileged cart operation (buyer attachment) is the
one that goes through a server route.

### Alternatives considered

| Design | Trade-off |
|---|---|
| Server-side cart in own DB, build Shopify cart at checkout | One authority fewer, but every cart click hits your serverless function; Shopify's abandoned-checkout emails and discounts wouldn't see the cart until the last moment. |
| Shopify-only (no localStorage/React mirror) | Simplest coherence story, but every render blocks on network; empty flash on reload. |
| localStorage-only until checkout | The original pre-migration design. No server-side cart at all; building the Shopify cart at checkout time makes checkout latency spiky and can fail late. |

### Scaling notes

The cart scales *per user*, not with traffic (each user talks to Shopify directly). The scaling
concerns are: Storefront API rate limits (per-IP; fine for real users, needs bot protection),
and the `lines(first: 50)` cap — a 51-line cart would silently truncate the mirror (acceptable for
this product domain; would need pagination for a marketplace).

---

## 7. Checkout & Payments: Two Migrations

This codebase has now been through **two** architectural migrations — checkout (Stripe → Shopify
hosted) and identity (Supabase → Shopify customer accounts). The first generation is no longer in
this repo: when the second migration committed to Shopify, the parked Stripe code was deleted here
and the complete working Stripe+Supabase implementation was preserved as its own project (sibling
fork, `stripe-legacy` branch). Rollback changed from "uncomment blocks" to "switch projects" —
cleaner than letting parked code rot in place.

### Generation 1: Stripe Elements (custom checkout) — now in the legacy fork

```
Cart ─► /checkout (client) ─► POST /api/create-payment-intent
                                   │  server recomputes amount from catalog by slug
                                   │  (NEVER trusts client prices), min charge check
                                   ▼
                              Stripe PaymentIntent ─► Elements form ─► redirect
                                   ▼
        /order-confirmation ─► server verifies PI status === "succeeded"
                                   ─► idempotent insert into Postgres `orders`
```

Security properties worth quoting in interviews (they carry over conceptually):
- **Server-side price authority**: client sends only `{slug, quantity}`; the server prices the
  cart from its own catalog. A tampered client can't buy sod for $0.01.
- **Idempotent order recording**: unique constraint on the payment-intent ID plus a
  read-after-conflict fallback made recording exactly-once-ish. (Weakness: recording on *page
  visit* rather than a webhook means a user who never returns from the redirect produces a
  paid-but-unrecorded order — one reason the migration was attractive.)

### Generation 2: Shopify hosted checkout (current)

```
Cart page ─► prepareCheckout():
               flush debounced quantity updates ─► await opQueue (all writes durable)
               ─► POST /api/cart/attach-buyer     (server: cartBuyerIdentityUpdate with
               │                                   customerAccessToken from httpOnly cookie)
               ─► window.location.assign(cart.checkoutUrl)   → Shopify owns everything after
```

`/checkout` and `/order-confirmation` remain as thin redirect/landing stubs so old links don't 404.

### The trade-off table (a genuinely balanced decision)

| Dimension | Stripe custom checkout | Shopify hosted checkout |
|---|---|---|
| UX control / branding | Full — checkout matches the site | Limited — Shopify's page; brandable (logo/colors), and on a production custom domain it runs at `yourdomain.com/checkouts/...` |
| PCI scope | SAQ-A via Elements iframes, but *you* run the checkout page | Essentially zero — never touch payment UI |
| Taxes, shipping rates, address validation | Build or integrate yourself | Included |
| Inventory decrement, receipts, refunds, fraud review | Build yourself (webhooks + admin UI) | Included |
| Order data ownership | First-party (your Postgres) | In Shopify; queried back via Customer Account API |
| Conversion | You own (and must optimize) the funnel | Shopify's heavily-optimized checkout, Shop Pay, signed-in customers land pre-filled |
| Failure surface | Your code between "paid" and "recorded" | Shopify's problem |

The deciding argument: with Stripe, the app owned the **hardest correctness problem in
e-commerce** — the money-moved-but-state-didn't gap — with no webhook infrastructure. Shopify
absorbs that whole class of bugs.

Two hosted-checkout seams worth knowing:
- **Embedding is impossible by design**: checkout pages ship `frame-ancestors` CSP; there is no
  web SDK that mounts checkout in your own DOM. The handoff is a full-page navigation. The
  production mitigations are a custom domain + checkout branding.
- **Return-path links** ("continue shopping", the logo) point at the store's online-store domain,
  not the headless frontend. Shopify's supported fix is publishing their lightweight
  *redirect theme* on the Online Store channel, which bounces any storefront traffic to the
  configured frontend hostname.

---

## 8. Orders & Order History

`/orders` is a `force-dynamic` server component: it reads the customer session from cookies,
queries the **Customer Account API** for that customer's own orders, and renders them. Each order
links (new tab) to its Shopify-hosted order-status page via the API's `statusPageUrl` field —
tracking, refunds, and "buy again" come for free from Shopify's page rather than being rebuilt.

```
/orders (RSC) ─► getCustomerSession()  (httpOnly cookies; lazy token refresh)
                    │ null ─► redirect /login
                    ▼
                 customer { orders(first: 50, sortKey: PROCESSED_AT, reverse: true) { … } }
                    ▼
                 render; each card → order.statusPageUrl (Shopify-hosted detail page)
```

### Why this design is a big deal relative to what it replaced

The previous generation had **no shared customer identity** between the auth system (Supabase)
and the commerce system (Shopify), so order history was a cross-system join keyed on **email**:
Admin API `orders(query: "email:...")`, merged with legacy Stripe-era rows from Postgres. That
design had real weaknesses, all documented at the time: a buyer using a different email at
checkout made the order invisible; email was interpolated into a search query (sanitized, but
still a smell); the Admin API only returns 60 days of orders without an extra scope; and the
Admin credential — a store-wide privilege — was being used to answer a per-user question.

Unifying identity on Shopify dissolved the join entirely: the customer token *is* the
authorization, the query can only ever return that customer's orders, and there is no email
matching to get wrong. This is the strongest single argument for the second migration.

*(Legacy Stripe-era orders live on in the fork's database; this storefront no longer displays
them — a deliberate simplification for a dev-store project.)*

---

## 9. Authentication (Shopify Customer Account API)

### The model: passwordless OAuth, tokens server-side only

Shopify customer accounts are passwordless (email → 6-digit one-time code; signing in with a new
email creates the account). The app is registered as a **public client** in the Headless
channel's Customer Account API settings, so the flow is OAuth 2.0 **authorization code + PKCE**:

```
/login page ─► GET /auth/login
                 │ generate state, nonce, PKCE verifier+challenge
                 │ stash them in short-lived httpOnly cookies (10 min)
                 ▼
              redirect to authorization_endpoint        (discovered, not hardcoded — see below)
                 ▼
              Shopify hosted sign-in (email + code)
                 ▼
              GET /auth/callback?code&state
                 │ state must match cookie; exchange code + verifier at token_endpoint
                 ▼
              set httpOnly cookies: access token (maxAge = expires_in − 60s),
                                    refresh token (30d), id_token (for logout)
                 ▼
              redirect to `next` (carried through the state cookie)
```

Key implementation decisions (`lib/shopify/customer.ts`):

- **Endpoint discovery**: authorization/token/logout endpoints come from
  `https://{store}/.well-known/openid-configuration`, and the Customer Account GraphQL URL from
  `/.well-known/customer-account-api` — cached per instance, never hardcoded. Shopify moves these;
  discovery is the supported contract.
- **Tokens never reach browser JS.** All three tokens are httpOnly cookies. Client components
  that need to know "am I signed in?" call `/api/auth/me`, which returns only
  `{signedIn, email, firstName}`. The cart's buyer attachment happens in a server route for the
  same reason.
- **Lazy refresh**: `getCustomerSession()` returns the access token from its cookie; if that
  cookie has expired, it uses the refresh token to mint a new set and hands the caller the
  refreshed tokens to persist. Route handlers persist them; server components *can't* write
  cookies in Next.js — they just use the fresh token, and the next route-handler request persists
  the refresh. (This asymmetry is a real App Router constraint worth knowing.)
- **The access-token cookie expires 60s before the token does**, so the server never presents a
  just-expired token.
- **Logout** hits Shopify's `end_session_endpoint` with `id_token_hint` so the Shopify-side
  session ends too — clearing only local cookies would leave the user silently signed in at
  checkout.
- **No middleware**: the Supabase design refreshed sessions in edge middleware on every request;
  here refresh happens only where a session is actually read. Fewer moving parts, and static
  pages pay zero auth tax.

### Sign-in surface

`/login` is a single "Continue with Email" button → `/auth/login`. No password form, no strength
meter, no OAuth-provider buttons — Shopify's hosted page owns credential UX. `/profile` is a
server component rendering Customer Account API data (name editable through a `customerUpdate`
server action; email read-only; initial-letter avatar).

### Why Shopify auth over the alternatives

| Option | Trade-off |
|---|---|
| **Supabase (the previous design)** | Solid auth + Postgres in one vendor — but it created a *second identity system* next to Shopify's customer records, and every commerce feature paid the join tax (§8). Worth it only while non-commerce features needed a database. |
| **NextAuth/Auth.js** | Free, flexible, but you own user storage and email flows, and the Shopify-join problem remains. |
| **Clerk/Auth0** | Polished, per-MAU pricing, *and* the join problem remains. |
| **Multipass SSO (own auth, silent Shopify session)** | The only way to make an external identity provider the front door — but Shopify Plus-only (~$2,300/mo), tied to *legacy* customer accounts, and unavailable on development stores. Researched and rejected. |

The clinching constraint: on a non-Plus store, **nothing but Shopify's own flow can create a
Shopify customer session**. Once checkout, orders, and marketing all key off Shopify's customer
identity, making Shopify the front door is the only design without a seam.

### Known operational constraint

Shopify **rejects `localhost` callback URIs** for the Customer Account API, so the auth loop can
only be exercised on a deployed URL (production or a registered preview). Local dev works for
everything except completing sign-in — a real DX cost, documented here deliberately.

---

## 10. Email Marketing (Shopify-native)

The previous generation wrote marketing *facts* to HubSpot (contact upserts with custom
properties) and let HubSpot workflows own email *policy*. That separation of facts/policy was the
right idea — the second migration kept the idea and changed the substrate:

- **Newsletter** (`/api/newsletter-signup`): validates + normalizes the email server-side, then
  upserts a Shopify **customer** with email-marketing consent (`SUBSCRIBED`, single opt-in) via
  the Admin API — `customerEmailMarketingConsentUpdate` if the customer exists,
  `customerCreate` otherwise. Subscribers appear in admin under Customers → Email subscribers;
  Shopify Email sends the campaigns. The API route exists because consent writes require the
  Admin credential, a server secret.
- **Abandoned-checkout emails**: Shopify Marketing Automations, configured in admin, no app code
  at all (next section).

**What was gained**: one fewer vendor, one fewer token, and the "facts" now live on the same
customer record that orders and auth use. **What was lost**: HubSpot's richer CRM segmentation
and multi-step workflow builder. For a store whose only automations were "newsletter" and
"abandoned cart", that trade is heavily one-sided — but the doc records it because at a larger
scale (lead scoring, lifecycle campaigns, sales handoff) a real CRM re-enters the picture, fed by
Shopify webhooks rather than app writes.

---

## 11. Abandoned-Checkout Recovery

The old pipeline was four systems deep (browser → Supabase shadow table → Vercel cron → HubSpot
properties → HubSpot workflow email). It existed because of one hard constraint: **Shopify has no
API to enumerate carts** — carts are fetchable only by ID, and the IDs live in shoppers' browsers.
To run a batch job over "carts that went quiet", the app first had to make cart state observable
server-side (the shadow-copy pattern: *client state must be made server-observable before batch
jobs can act on it* — still a great interview pattern, even though this app no longer needs it).

The current design deletes the entire pipeline in favor of Shopify's native machinery:

```
Signed-in user clicks Checkout ─► buyer identity attached to cart (server route)
Shopper opens hosted checkout  ─► Shopify creates a checkout record with contact info
Shopper doesn't complete       ─► record appears in admin "Abandoned checkouts"
Marketing Automation (admin-configured) ─► recovery email with a restore-cart link
```

Verified empirically on the dev store: an opened-but-unfinished checkout shows up in
`abandonedCheckouts` (Admin API) with the customer email and a recovery URL.

**The honest boundary**: Shopify's trigger is *checkout* abandonment. A shopper who fills a cart
but never clicks Checkout never creates a checkout record, so no email fires — the old
cart-stage cron nudged earlier in the funnel (for signed-in users only). That coverage was
consciously traded away for deleting a four-system pipeline. If cart-stage recovery ever matters
again, the Shopify-native rebuild is: write cart facts to **customer metafields** (Admin API),
build a customer **segment** on those metafields, and trigger a marketing automation on segment
entry — same facts/policy split, zero external vendors.

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
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | Browser | Public-by-design (Headless channel public token), storefront-scoped, rate-limited |
| `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` | Server env (public-class) | OAuth *public client* ID — not a secret by OAuth definition; PKCE + registered redirect URIs are the actual protection |
| Customer access/refresh/id tokens | httpOnly cookies only | Per-user, never readable by browser JS; used server-side for Customer Account API + cart buyer attachment |
| `SHOPIFY_CLIENT_ID`/`SECRET` | Server only (`lib/shopify/admin.ts`) | Mint 24h Admin tokens (customer consent writes; store-wide privilege) |
| `ANTHROPIC_API_KEY` | Server only | Proxied via API routes |

Enforcement is structural, not just conventional: server-secret modules import **`server-only`**,
so accidentally importing `lib/shopify/admin.ts` or `lib/shopify/customer.ts` into a client
component is a build error, not a leak.

### OAuth flow protections

- **PKCE (S256)** binds the authorization code to this app instance — an intercepted code is
  useless without the verifier cookie.
- **`state`** (random, cookie-matched) prevents CSRF on the callback; the post-login destination
  rides inside the state cookie rather than a user-controllable query param (open-redirect
  guard: the callback only redirects to same-origin paths).
- **`nonce`** is issued for id-token replay protection.
- Round-trip cookies (state/verifier/nonce) are httpOnly, `secure`, `sameSite=lax`, 10-minute TTL,
  and deleted on completion.

### Application-level protections

- **Price integrity**: never trust the client. Checkout reads the server-side Shopify cart; the
  localStorage mirror is display-only.
- **Per-user data scoping**: orders/profile are fetched with the *customer's own* token — the
  server cannot accidentally query another user's data because the credential itself is scoped.
- **Injection surfaces**: email is regex-validated + normalized, and quotes/backslashes stripped,
  before interpolation into the Admin customer search; uploaded images validated by magic bytes;
  chat request shape validated before proxying.
- **LLM safety**: closed-enum tools + "never state facts that didn't come from a tool" bound both
  hallucination and prompt-injection blast radius (a hostile prompt can't make the bot invent
  prices — worst case it calls a harmless catalog filter).

### Gaps to name proactively (better to volunteer these in an interview)

No rate limiting on the AI endpoints (cost DoS); no CSRF tokens on JSON POSTs (low risk: the only
cookie-authenticated state-changing POST is `attach-buyer`, whose worst-case abuse is attaching
*your own* identity to a cart ID you'd have to know); `/api/auth/me` briefly makes a Customer
Account API call per navigation (cheap, but cacheable); and the id/refresh cookies ride a 30-day
window regardless of Shopify-side revocation until next use.

---

## 15. Failure Modes & Resilience

A recurring theme: **every third-party dependency has an explicit degradation path.**

| Failure | Blast radius | Mechanism |
|---|---|---|
| Shopify down at build time | Slower first page loads, deploy still succeeds | `generateStaticParams` catch → on-demand rendering |
| Shopify down at runtime (catalog) | Search empty; ISR keeps serving last-good HTML until revalidation succeeds | layout try/catch; stale-while-revalidate semantics |
| Shopify cart mutation fails | One user's cart briefly wrong, then reconverges | queue catch → `cartGet` re-sync, server wins |
| Customer Account API fails on /orders or /profile | Redirect to /login (treated as signed-out) rather than 500 | try/catch around session-scoped queries |
| Token refresh fails (revoked/expired refresh token) | User is signed out; next sign-in is one email code away | `getCustomerSession` returns null on refresh failure |
| Buyer attachment fails at checkout | Checkout proceeds as guest (email typed manually) | `attach-buyer` is best-effort; errors logged, never blocking |
| Newsletter Admin API failure | Form shows retryable error; no partial state | single upsert-style write, 502 to client |
| Anthropic fails | Chat shows a friendly error bubble | route 502 → widget error message |
| Cart line lost between systems | Old pre-migration items dropped on load | `variantId` filter at hydration |

Patterns to name: graceful degradation per dependency, idempotent writes (seed script, consent
upsert), server-authoritative reconciliation instead of client retry, stale-while-revalidate as
an availability tool (not just performance), and best-effort enhancement (buyer attachment) that
never blocks the critical path.

What's *missing*: retries with backoff (most failures are "log and degrade"), circuit breakers,
structured observability (only `console.error` → Vercel logs), and alerting. Right-sized for the
scale, but the interview answer for "what would you add first in production" is: **error tracking
(Sentry) + alerting on auth-callback failures** (silent sign-in breakage is the worst failure this
app can have).

---

## 16. Scaling Roadmap: 10x / 100x / 1000x

### 10x (a real small business: ~10k users, hundreds of orders/day)

- **Event-driven cache invalidation**: Shopify `products/update` webhook → verify HMAC →
  `revalidateTag("shopify")`. TTL stays as backstop. (The cache tag already exists for this.)
- **Rate limiting** on `/api/lawn-assistant` (per-IP token bucket via Upstash/Vercel KV) — the
  only endpoint where an attacker directly spends your money.
- **Streaming** the assistant (SSE) and Anthropic prompt caching for the static system prompt.
- **`/api/auth/me` caching**: short-lived (per-request or few-minute) memoization so header
  renders stop hitting the Customer Account API on every navigation.
- **Observability**: Sentry, structured logs, auth-funnel metrics + alerting.
- **Production store polish**: custom domain (checkout on own domain), checkout branding,
  redirect theme for storefront-bound links.

### 100x (mid-market: catalog in the thousands, orders in the thousands/day)

- **Catalog**: cursor pagination everywhere; pre-render only top sellers; move search to a
  dedicated engine fed by webhooks (Algolia/Meilisearch) with facets and typo tolerance.
- **Cart-stage marketing**: if checkout-stage recovery isn't enough, the Shopify-native rebuild
  from §11 (customer metafields → segment → automation), or a CRM re-introduced behind webhooks.
- **Owned data layer returns — behind webhooks**: order/customer webhook mirror into a warehouse
  or Postgres for analytics and long-horizon queries. The difference from the old design: the
  mirror is a *projection* for reads, never a second identity system.
- **AI**: conversation summarization/truncation, response caching for common questions,
  model-tiering (Haiku-class model for intent extraction, larger model only when needed).
- **Regionalization**: Vercel is edge-global and Shopify's CDN is global; there is no owned
  single-region database left on the hot path.

### 1000x (platform scale) — mostly a *different business*, but directionally:

- Headless commerce re-evaluation: Shopify Plus (checkout extensibility, Multipass if an external
  identity provider must become the front door, higher API limits), or unbundling again
  (dedicated OMS, payment orchestration across PSPs).
- CQRS-style split: all reads from owned, webhook-fed projections (Postgres/search index);
  third-party APIs only on the write path.
- The cart's client-side op queue would be re-homed server-side (or into Shopify entirely) to
  support multi-device carts merged by customer identity — the identity half of that already
  exists now.

The honest meta-answer: the current architecture's SaaS-heavy shape means **10x and 100x are
mostly configuration and a few webhooks, not rewrites** — that's what buying instead of building
purchases.

---

## 17. Known Limitations & Honest Critique

Interviewers respect self-awareness. Real issues in the current code:

1. **Auth is untestable locally** — Shopify rejects `localhost` callback URIs, so the sign-in
   loop can only be exercised on a deployed URL. Local dev covers everything else; CI/preview
   deploys carry the auth verification burden.
2. **Checkout-stage-only abandonment recovery** — a cart that never reaches the Checkout click
   generates no recovery email (§11 documents the trade and the Shopify-native rebuild path).
3. **No automated tests** — the cart's op-queue/debounce logic is exactly the kind of concurrency
   code that regresses silently; it's the first thing that deserves unit tests (fake timers +
   mocked Shopify client). The auth callback (state/PKCE handling) is second.
4. **No rate limiting / abuse control on AI endpoints** — direct cost exposure.
5. **Duplicated AI surface** — `/api/identify-pest` + `/pest-identifier` predate the chat-widget
   tool and should be consolidated or deleted (dead-ish code with a live API key behind it).
6. **`lib/data.ts` dual role** — seed fixture *and* live source for guides/types. The assistant's
   pest fixture (`lib/pests.ts`) is local while control-product *prices* come from Shopify on the
   pest pages; the chat's treatment info can drift from the store.
7. **Order line totals ignore order-level discounts** — the orders page computes line totals as
   `price × quantity`; a discounted order's lines won't sum to its total (the total itself is
   correct; the hosted order page is authoritative).
8. **Search index in every page payload** — fine now, a payload tax as the catalog grows.
9. **Historical data amputated** — Stripe-era orders exist only in the legacy fork's database;
   this storefront shows Shopify orders only. Fine for a dev store, a real migration would import
   them (Shopify order import or a read-only "archive" section).
10. **Session revocation lag** — refresh/id-token cookies live 30 days client-side; a
    Shopify-side revocation is only discovered on next use.

---

## 18. Interview Talking Points

Condensed narratives this codebase lets you tell first-hand:

1. **Build vs. buy, argued concretely** — payments, auth, identity, marketing, and inference are
   all bought; §7's trade-off table is a complete worked example with a real migration between
   the two sides of it.
2. **Two real migrations, two strategies** — checkout moved with a strangler-fig flavor
   (anti-corruption layers, parked rollback code, retired endpoints returning 410); identity
   moved with a **fork-and-commit** strategy (legacy system preserved as a runnable sibling
   project, new system cut over cleanly with no half-state in the codebase). Being able to argue
   *when each strategy fits* is the senior-engineer version of the story.
3. **Distributed state coherence** — three cart representations, one authority, optimistic UI,
   a serialized op queue for non-commutative mutations, debounced writes, and
   reconcile-from-server on failure. Maps directly to classic "design a collaborative cart/doc"
   questions.
4. **Identity unification as a design forcing-function** — the email-join fragility of the split
   design (§8) versus credential-scoped queries after unification; why "who owns identity" is an
   architecture decision, not a library choice.
5. **OAuth done properly in a serverless app** — discovery, PKCE, state/nonce, httpOnly-only
   tokens, lazy refresh with the RSC cookie-write constraint, and hosted-logout via
   `id_token_hint`.
6. **Layered caching with an invalidation story** — CDN/ISR + fetch cache + tags, TTL as
   backstop, webhooks as the planned upgrade, `no-store` where staleness is dangerous.
7. **Grounded LLM product design** — intent extraction vs. fact generation, closed enums,
   deterministic filters over live data, structured side-channel responses, server-proxied keys,
   magic-byte input validation, bounded tool loops.
8. **The shadow-copy pattern and when to delete it** — client state must be made
   server-observable before batch jobs can act on it (§11's old pipeline); and the equally
   important judgment call of deleting the pipeline when the platform grew a native equivalent.
9. **Security tiering** — public-by-design tokens vs. server secrets vs. per-user credentials in
   httpOnly cookies, `server-only` as structural enforcement, and the humility to list the gaps
   (§14, §17).

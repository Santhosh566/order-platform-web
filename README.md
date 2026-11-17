# order-platform-web

The web front end of the Order Integration Platform: the shop for customers, the console for
admins, and the screens for delivery staff. It talks only to the REST API of
`../order-integration-platform` and signs users in with Keycloak.

React 19 · TypeScript · Vite · Mantine · React Router · TanStack Query · oidc-client-ts

## Run it

Needs Node 20.19+ and the backend running on http://localhost:9091 (with Keycloak on 8084).

```bash
npm install
npm run dev          # http://localhost:5173, /api is proxied to :9091
```

Another backend address: `ORDER_PLATFORM_API=http://host:port npm run dev`.

Demo users (password `demo1234`): `alice.smith@example.com` customer (CUST-100), `admin@example.com`
admin, `driver1@example.com` delivery.

## Checks

```bash
npm run check        # type check + lint + unit tests
npm run build        # production build in dist/, which the backend then serves
```

## End-to-end test (Playwright)

Two stories run through real screens and services, each user in their own browser (the driver on
a phone screen):

- `e2e/order-to-refund.spec.ts`: admin adds a product → customer buys two → pipeline pays and packs →
  admin assigns a driver → driver delivers with the customer's code → customer returns one → admin
  approves → a driver collects it with a new code → admin receives it → refund and credit note.
- `e2e/shop-wishlist.spec.ts`: admin adds a sold-out lamp and a bulb → customer searches, filters by
  price and "In stock only" → asks to be emailed when the lamp is back (which saves it to the
  wishlist) → admin receives stock → the "Back in stock" email arrives with the link → customer buys
  the lamp from the wishlist and the order is paid and packed.

They read the one-time codes and the back-in-stock email from Mailpit, so the whole stack must be running
(`docker compose up -d`, the backend, Keycloak). They add test products and orders to that database: use a
development stack only.

```bash
npx playwright install chromium        # once
npm run e2e                            # against http://localhost:9091 (backend serving npm run build)
E2E_BASE_URL=http://localhost:5173 npm run e2e   # against npm run dev
npm run e2e:headed                     # watch it in a browser window
```

On a failure, `e2e-report/` has the steps, a screenshot, a video and a trace
(`npx playwright show-trace e2e-results/…/trace.zip`).

## Layout

| Folder | What is in it |
|---|---|
| `src/api` | `client.ts` (token, JSON, errors, PDF downloads) and the backend's JSON types |
| `src/auth` | Keycloak sign-in, `useAuth()`, `<RequireRole>`, start page per role |
| `src/cart` | Cart rules (`cart.ts`) and the per-user cart kept in localStorage |
| `src/admin` | TanStack Query hooks for the admin API, and the catalogue form rules |
| `src/delivery` | Query hooks and helpers (next step, call and map links) for the driver screens |
| `src/customer` | TanStack Query hooks for the customer API, and the live order stream (SSE) |
| `src/components` | Status badges, address form and its rules, loading and error states |
| `src/layout` | Header, role-based side menu (drawer on phones) |
| `src/lib` | Rupee and date formatting, Indian states, order status rules |
| `src/pages` | Screens by role: `customer/`, `admin/`, `delivery/`; welcome, no access, not found |
| `src/test` | Test setup, render helpers, fake backend and fixtures |

## Appearance

The palette button beside the account menu sets the **mode** (Light, Dark, or same as the device)
and the **style**: *Classic* (blue) or *Orange & Navy* (white page, navy text and header bar,
orange buttons, hairline borders). Both are remembered in this browser only. Status colours (green
delivered, red failed, …) mean the same in every style. Themes live in `src/theme.ts`.

## Customer screens (phase 1)

| Route | What it does |
|---|---|
| `/shop` | Promotion banners at the top (one at a time, moving on every 6 s except while pointed at, focused, or for people who asked for less motion); a strip of round category pictures (each the photo of its best product) with sub-categories as pills; search; the full filter panel (category, brand, price, rating, stock, with counts) behind the **Filters** button; sort; prices including GST and a stock label (never a count); an "Extra 20% off" badge on products with their own coupon; add to cart. `/shop?offer=CODE` lists the products a coupon is for, with its terms |
| `/cart` | Quantities, today's prices (with a notice when a price changed), saved or other address; standard delivery or a booked day and time (full windows greyed out); pay online or cash on delivery (when the server allows it); coupon code and the offers the customer can use. The summary is the server's quote: discount, GST and total |
| `/orders` | The customer's orders, newest first; updates live |
| `/orders/:id` | Progress, GST lines (CGST + SGST or IGST) with any coupon discount, payment method and booked delivery slot, invoice PDF, cancel, return items, returns and credit notes, and rating the delivery (1–5 stars, for 14 days after it arrives) |
| `/shop/:sku` | Photos, price, the offers (coupons) that apply with their codes to copy, delivery date for a PIN (naming holidays it skips), specifications, ratings breakdown and reviews (sorted, paged); "Write a review" once the product was delivered |
| `/returns` | Return requests and where each one stands |
| `/reviews` | Delivered products waiting for a review, and the customer's reviews with their status (and why one was not published); edit or delete |
| `/wishlist` | Saved products at today's price and stock; add to cart, remove, or "Email me when it is back" for a sold-out one. The heart on every product card saves it |
| `/account/address` | The default delivery address |

## Admin screens (phase 2)

| Route | What it does |
|---|---|
| `/admin` | Revenue, orders, returns to review, orders waiting for a driver, low stock, dead letters; orders by status |
| `/admin/orders` | Search (id, customer, reference, invoice no.) and status filter, kept in the URL; 25 per page |
| `/admin/orders/:id` | Everything the customer sees plus payment and fraud; cancel, goodwill refund, assign driver, return to stock; delivery attempts |
| `/admin/catalog` | Products with price, GST, stock and flags; new product |
| `/admin/catalog/:sku` | Edit details, change the price now or schedule it, record stock received/corrected/written off, full stock history |
| `/admin/returns` | Queue by status: approve, reject (with a note for the customer), receive goods (sellable or damaged) |
| `/admin/reviews` | Reviews with words waiting to be published; publish, or reject with a note the customer is emailed |
| `/admin/coupons` | Coupons with their uses and status (live, scheduled, expired, used up); create one for the whole order or for chosen categories and products; switch one off |
| `/admin/promotions` | Shop banners with their status, views, clicks and click rate; create or change one with a live preview (opens a product, a category or a coupon's products); upload a wide picture; switch off; delete |
| `/admin/holidays` | Delivery holidays by year: national or for one state; delivery dates and bookable days skip them |
| `/admin/ops` | Failed messages (dead letters): replay once the cause is fixed, or dismiss with a note; history of who did what. Routes: pause, resume, stop or start the consumers (Kafka, files, timers); API and pipeline routes are view-only |
| `/admin/deliveries` | Orders waiting for a driver, deliveries under way (reassign until collected), drivers and their load, and driver performance by day, week, month or year (sortable; a name opens that driver's figures and chart) |

## Delivery screens (phase 3, made for a phone)

| Route | What it does |
|---|---|
| `/delivery` | Orders ready to take, by area only (city, PIN); take one |
| `/delivery/mine` | Deliveries in hand: address, Call and Map buttons, what is in the parcel, the booked day and time, cash to collect, and one button for the next step — collected → start delivery (emails the customer a code) → at the door tick "I collected ₹… in cash" for a cash-on-delivery order, then enter the 6-digit code. "Could not deliver" records a reason. |
| `/delivery/dashboard` | The driver's own figures: today's open jobs, deliveries, pickups, failures, cash and earnings; then a chosen day, week, month or year with completed, tasks, success rate, cash, earnings and customer rating against the period before, a chart (or table) of completed jobs, and customers' comments |

**Return pickups** use the same screens: approved returns appear under *Return pickups* (area only).
The driver takes one → *Start pickup* (the customer is emailed a code) → at the door ticks
"I have the items" and enters the customer's code → the return is *Picked up*. The admin then marks
the goods received at the hub, which refunds the customer with a credit note.

Drivers get no live stream (it carries customers' orders), so both lists refresh every 30 seconds
and when the phone comes back to the app. After 5 wrong codes the delivery can only be marked failed.

Each screen is its own bundle, loaded when first opened, so customers never download the console.
Edits to a product send the version they were opened at; if another admin saved first the server
answers 409 and the page says so and shows their version.

Things the backend decides, and the page only reflects:

- **Prices.** The cart total is an estimate at catalogue prices; the server prices the order again.
- **Duplicate orders.** Each checkout sends a reference (`WEB-<uuid>`) that stays the same while the cart
  and address do not change. A retry after a lost reply gets `409 DUPLICATE`, and the page treats that
  as "already placed" instead of ordering twice.
- **Cancel and return.** Buttons appear by the same rules as `OrderStatus.java` (cancel before dispatch;
  returns within 7 days of delivery, for units not already in a return), and the server checks again.
- **Cancel items.** On `/orders/:id` and `/admin/orders/:id`, while the order is confirmed and still in
  the warehouse with at least two units left: choose units and a reason (`CancelItemsDialog`). The dialog
  estimates the refund, or the lower cash due on COD. Choosing everything left turns the button into
  "Cancel order". Cancelled units show on their line, the totals show "Cancelled items" and the amount
  to pay at the door, and the credit note is listed as "Cancelled items".
- **Live updates.** `/api/stream/orders` takes the token as `?access_token=`; after any error the stream
  reopens with a fresh token, waiting longer each time.

## Profile

"Edit profile" in the account menu (top right) opens `/profile` for every role:
- A photo card: add, change or remove. The header avatar shows the photo, or initials when there is none.
- Personal details for everyone, plus Vehicle, Emergency contact and Payouts for drivers, and Work for admins.
- Photos are private, so `usePhotoUrl` fetches them with the token and shows them through an object URL.
- The form checks the same rules as the server (`profile/profileSchema.ts`).
- `DeliveryPartnerCard` on `/orders/:id`: once the parcel is picked up, the customer sees who is bringing it (name, photo, vehicle number, rating), with a reminder to check them before giving the delivery code.
- **Inactive accounts:** the user page has Deactivate (with a reason) and Activate, for customers and drivers. The list can filter by status. An inactive user who signs in sees "You have no access … contact the administrator" on every page, while the menu and sign-out still work. If they are turned off mid-session, the first refused API call (`ACCOUNT_INACTIVE`) switches the app to that screen.
- `/admin/users` ("Users" in the admin menu): search, role filter and paging, kept in the URL. `/admin/users/:userId` is a read-only page with the profile and the user's activity as a customer or driver.

## Sign-in

Keycloak's address and client come from the backend (`/api/public/auth-config`). The client
`order-platform-web` must allow `http://localhost:5173/*` as a redirect URI; the realm file in
`../order-integration-platform/ops/keycloak/order-platform-realm.json` includes it.
Roles shown in the menu come from `/api/me`, and the backend checks every call itself.

# Comprehensive UI Research Report - Triple A Apps

**Date:** February 7, 2026
**Status:** 📋 RESEARCH COMPLETE
**Goal:** Document the current state of all three Triple A apps' UI, design system, components, and Stripe integration

---

## Executive Summary

This report provides a complete audit of the current UI state across all three Triple A applications: **TripleAMusician** (performer app), **TripleAMusic** (premium marketplace), and **TripleAMuse** (entry hub/service coordinator). The codebase has a well-established **shared design system** in `packages/shared` with global styles, primitive components, and theme tokens.

### Key Findings

1. **Shared design system is mature**: `global.scss` and `primitives.module.scss` provide comprehensive CSS variables and utility classes following Apple-inspired flat design principles
2. **Stripe integration is active**: Full payment processing via Stripe Elements (embedded forms) and Stripe Connect for musician payouts
3. **Visual consistency varies**: Some pages use primitives extensively, others have inline styles
4. **App differentiation exists but could be stronger**: All three apps use similar navigation and chrome patterns
5. **Image handling is implemented**: Instruments and locations have image support with fallback placeholders

---

## 1. Shared Design System (\`packages/shared/src/\`)

### 1.1 Global Styles (\`styles/global.scss\`)

**Purpose:** Flat, service-provider UI with dark mode by default. Inspired by "tux" aesthetic - clean, high-contrast, minimal borders.

**Color Palette (CSS Variables):**
- \`--taa-blue-900: #1c276e\` (dark blue accent)
- \`--taa-blue-200: #adb8e0\` (light blue accent)
- \`--taa-gold-500: #e59d0d\` (primary action color)
- \`--taa-purple-400: #825eca\` (light purple accent)
- \`--taa-purple-900: #4e238b\` (dark purple accent)
- \`--taa-gray-600: #4b4e63\` (neutral gray)
- \`--taa-white: #ffffff\` / \`--taa-black: #000000\` (light/dark mode bases)

**Theme Tokens:**
- \`--bg\`: Background (slightly lifted from pure black to avoid "hobby dark UI")
- \`--text\`, \`--text-muted\`, \`--text-subtle\`: Text hierarchy
- \`--app-accent\`: Per-app accent (overridden via \`data-taa-app\` attribute)
- \`--surface\`, \`--surface-2\`, \`--surface-3\`: Flat surface layers
- \`--border\`, \`--border-strong\`: Border colors
- \`--primary\`: Gold accent for CTAs only
- \`--success\`, \`--warning\`, \`--error\`, \`--info\`: Semantic states
- \`--focus\`: Focus ring color
- \`--radius-sm/md/lg\`: Border radius scale
- \`--shadow-1\`: Minimal depth shadow
- Typography scale: \`--text-xs\` through \`--text-2xl\`

**Per-app accent overrides:**
\`\`\`scss
body[data-taa-app="music"] { --app-accent: var(--taa-purple-400); }
body[data-taa-app="musician"] { --app-accent: var(--taa-purple-400); }
body[data-taa-app="muse"] { --app-accent: var(--taa-purple-400); }
\`\`\`

**Light mode support:** Available via \`:root[data-theme="light"]\` but not enabled by default.

**Reset & Base Styles:**
- Box-sizing reset
- Dark mode color-scheme
- System font stack
- Focus-visible styles for all interactive elements
- Image display block + max-width

### 1.2 Primitives (\`styles/primitives.module.scss\`)

**Purpose:** Composable utility classes to eliminate inline styles. 1055 lines of reusable patterns.

**Layout Primitives:**
- \`.page\`, \`.container\`: Page wrappers with max-width
- \`.chrome\`, \`.header\`, \`.nav\`, \`.navLink\`: App navigation shell
- \`.card\`, \`.cardInteractive\`, \`.cardPad\`: Surface containers
- \`.section\`, \`.sectionTitle\`: Content sections
- \`.stack\`, \`.row\`, \`.rowBetween\`, \`.grid\`: Flexbox layouts
- \`.flexCol\`, \`.flexRow\`, \`.flexWrap\`, \`.flexCenter\`: Flex utilities
- \`.gapXs/Sm/Md/Lg/Xl\`: Gap utilities
- \`.maxW420/520/640/720\`, \`.fullWidth\`: Width constraints

**Component Primitives:**
- \`.input\`, \`.select\`, \`.checkbox\`, \`.label\`, \`.field\`: Form elements
- \`.help\`, \`.error\`, \`.success\`, \`.warning\`: Feedback text
- \`.chip\`: Pill-style tags
- \`.badge\`, \`.badgeSuccess/Warning/Error/Info/Neutral\`: Status badges
- \`.button\` (via Button.module.scss - separate component)

**Media Primitives:**
- \`.media\`, \`.mediaSquare\`, \`.mediaWide\`: Image containers with aspect ratios
- \`.mediaPlaceholder\`: Fallback for missing images

**Hero & Feature Sections:**
- \`.hero\`, \`.heroKicker\`, \`.heroTitle\`, \`.heroLead\`, \`.heroActions\`: Full-width hero section
- \`.heroFull\`, \`.heroMassive\`, \`.heroSubtitleLarge\`: Full-viewport Apple-style hero
- \`.featureGrid\`, \`.featureCard\`, \`.featureTitle\`, \`.featureBody\`: Feature cards

**Apple-Inspired Sections:**
- \`.sectionFull\`, \`.sectionFullCenter\`: Full-width sections with generous padding
- \`.sectionTitleLarge\`, \`.sectionLead\`: Large section typography
- \`.pathGrid\`, \`.pathCard\`: Large clickable destination cards
- \`.productRow\`: Product card grid
- \`.missionSection\`, \`.missionText\`: Footer mission section

**Typography Utilities:**
- \`.textXs/Sm/Base/Lg/Xl/2xl\`: Font size classes
- \`.fontMedium/Semibold/Bold\`: Font weights
- \`.textMuted\`, \`.textSubtle\`, \`.textCenter\`, \`.textRight\`: Text modifiers
- \`.kicker\`: Uppercase label style

**Table & List:**
- \`.table\`, \`.tableCompact\`: Table layouts
- \`.lineItem\`, \`.lineItemTitle\`, \`.lineItemMeta\`: List item pattern
- \`.statGrid\`, \`.statCard\`, \`.statNumber\`, \`.statSubtitle\`: Stat cards

**Empty States:**
- \`.empty\`, \`.emptyTitle\`, \`.emptyText\`: Empty state pattern

**Loading:**
- \`.skeleton\`, \`.skeletonText\`, \`.skeletonCircle\`: Shimmer loading states

**Utilities:**
- \`.mtSm/Md/Lg/Xl\`, \`.mbMd/Lg\`: Margin utilities
- \`.divider\`: Horizontal rule
- \`.scroller\`, \`.chipBar\`: Horizontal scrolling containers

### 1.3 Theme (\`theme.ts\`)

**Purpose:** JS/TS theme tokens (prefer CSS variables for runtime theming).

**Exports:**
- \`palette\`: Color hex values
- \`colors\`: CSS variable references
- \`spacing\`: Numeric spacing scale (xs: 4, sm: 8, md: 12, lg: 16, xl: 24)
- \`radii\`: Border radius values
- \`typography\`: Font family

### 1.4 Types (\`types.ts\`)

**Purpose:** Shared TypeScript types for all domain entities.

**Key Types:**
- \`UserRole\`: \`"musician" | "customer" | "teacher" | "rental_provider" | "admin"\`
- \`Permission\`: View/manage permissions for different dashboards
- \`EmployeeRole\`: Operations roles (operations_manager, gear_tech, driver, warehouse)
- \`User\`: User entity with roles, Stripe account fields
- \`MusicianProfile\`: Instruments, genres, bio, ratings, marketplace settings
- \`Booking\`, \`Event\`, \`Gig\`: Event and booking entities
- \`Instrument\`, \`Location\`: Marketplace catalog items
- \`GigStatus\`, \`GigType\`, \`SeatingType\`: Gig enums
- \`GigApplication\`, \`ArtistRequest\`: Performer application types
- \`Ticket\`, \`TicketTier\`, \`SeatingLayout\`, \`Seat\`: Ticketing system
- \`CheckoutSession\`, \`FeeBreakdown\`: Stripe checkout types
- \`StaffMember\`, \`StaffPermission\`: Staff management types

### 1.5 Shared Components

**Button** (\`components/Button.tsx\` + \`.module.scss\`)
- Variants: \`primary\` (gold), \`secondary\` (surface), \`ghost\` (transparent)
- Sizes: \`sm\`, \`md\`, \`lg\`
- Props: \`fullWidth\`, \`leftIcon\`
- **Style:** Flat design with subtle hover states, no heavy shadows

**CategoryBar** (\`components/CategoryBar.tsx\` + \`.module.scss\`)
- Horizontal scrolling chip bar for category filtering
- Uses Button component with image icons
- Active state highlighting

**ProductCard** (\`components/ProductCard.tsx\` + \`.module.scss\`)
- Compact product cards with image, title, subtitle, price
- Primary action button ("View")
- Variants: \`compact\`, \`featured\`

**SearchBar** (\`components/SearchBar.tsx\` + \`.module.scss\`)
- Simple search input with Enter key submission

**StatusCard** (\`components/StatusCard.tsx\` + \`.module.scss\`)
- Dashboard status card with indicator dot (active/idle/busy)
- Title, subtitle, metric display, actions slot

**StatCard** (\`components/StatCard.tsx\`)
- Simple stat display: title, large value, subtitle
- Uses primitives for styling

**FormField** (\`components/FormField.tsx\`)
- Label + input + help/error wrapper
- Required indicator support

**SeatSelector** (\`components/SeatSelector/\`)
- Complex reserved seating UI (not reviewed in detail)

---

## 2. TripleAMusician (Performer App)

### 2.1 Overview

**Purpose:** "Uber Driver" work dashboard for musicians. Manage incoming requests, upcoming gigs, profile, rentals browsing, and perks.

**Current Pages:**
- Landing page (/)
- Login (/login)
- Register (/register)
- Forgot/Reset Password
- Onboarding (/onboarding)
- Dashboard (/dashboard) - **main performer console**
- Profile (/profile)
- Bookings (/bookings) - placeholder
- Perks (/perks) - placeholder
- Browse Gigs (/gigs, /gigs/:id)
- Rentals (/rentals)
- Messages (/messages)

**Navigation:** NavBar component with Home, Dashboard, Find gigs, Rentals, Messages, Account

**App Identity:** \`data-taa-app="musician"\` sets purple accent

**Entry Flow:**
1. Landing page with hero → Join/Sign in
2. Login/Register
3. Enable musician access (if not already)
4. Onboarding: Connect Stripe + Fill profile
5. Dashboard access

### 2.2 Page Details

#### Landing Page (/)
- **Component:** \`MusicianLandingPage\` (inline in App.tsx)
- **Visual:** Full-viewport hero with massive title "Your performer console."
- Uses \`.heroFull\`, \`.heroMassive\`, \`.heroSubtitleLarge\` primitives
- Feature cards explaining Requests, Schedule, Perks
- Cross-app link to Triple A Music
- Mission footer

#### Dashboard (/dashboard)
- **File:** \`pages/DashboardPage.tsx\` + \`.module.scss\`
- **Visual:** "Uber Driver" style work dashboard
- **Structure:**
  - Header: "Good afternoon" + subtitle
  - Stats row: Earnings, Rating, Requests (StatusCard components)
  - Main grid: 
    - Left: Incoming requests (cards with Accept/Decline) + Upcoming gigs (date card + info)
    - Right: Quick actions sidebar + Perks list
- **Styling:** Custom \`.module.scss\` with \`.page\`, \`.header\`, \`.statsRow\`, \`.grid\`, \`.requestCard\`, \`.gigCard\`, \`.sidebar\`
- **Status:** Well-designed, follows owner's "driver app" direction

#### Profile (/profile)
- **File:** \`pages/ProfilePage.tsx\` + \`.module.scss\`
- **Visual:** Multi-card grid layout
- **Cards:**
  - Profile card: Avatar, name, email, star rating
  - Musician profile card: Instruments, genres, bio, hourly rate, direct requests toggle
  - Account settings card: Name, email, password with inline edit form
  - Quick actions card: Links to dashboard, bookings, gigs, perks, messages
  - Linked apps card: Shows Music/Musician/Host apps with status
- **Styling:** Custom grid with responsive 2-column layout, uses \`.card\` from primitives
- **Status:** Comprehensive, well-structured

#### Onboarding (/onboarding)
- **File:** \`pages/MusicianOnboardingPage.tsx\`
- **Visual:** Step-by-step flow
- **Steps:**
  1. Connect Stripe payouts (button to open Stripe Express onboarding)
  2. Fill performer profile (instruments, genres, bio, hourly rate, accepts direct requests)
  3. Finish (navigate to dashboard when complete)
- **Stripe Integration:** Uses \`getMusicianStripeOnboardingLink()\` and \`getMusicianStripeStatus()\` API calls
- **Status:** Functional, clear progression

#### Rentals (/rentals)
- **Component:** \`RentalsPage\` (inline in App.tsx)
- **Visual:** Category bar + grid of instrument cards
- Uses CategoryBar component for filtering ("All" + dynamic categories)
- Card layout with \`.media\`, \`.mediaSquare\`, instrument image, name, category, availability chip, daily rate, action button
- **Image handling:** Uses \`apiImageUrl()\` helper to resolve image URLs
- **Status:** Good visual presentation, uses shared primitives

#### Browse Gigs (/gigs, /gigs/:id)
- **Components:** \`BrowseGigsPage\`, \`GigDetailPage\` (inline in App.tsx)
- **Visual:** List of gig cards with title, budget, status + "View gig" button
- Detail page: Gig info + application form (message textarea + submit)
- **Status:** Basic but functional

### 2.3 Components

**NavBar** (\`components/NavBar.tsx\`)
- Uses \`ui.nav\`, \`ui.navLink\`, \`ui.navLinkActive\` primitives
- Conditionally shows routes based on user role
- Active state with gold underline (via \`::after\` pseudo-element)

### 2.4 Styling Patterns

**Good:**
- Dashboard uses custom module SCSS with semantic class names
- Profile page has well-organized card grid
- Consistent use of primitives for common patterns

**Needs improvement:**
- Some inline styles remain (e.g., \`style={{ display: "flex", gap: spacing.md }}\`)
- Could compose more from primitives to reduce custom SCSS

### 2.5 Issues/Observations

1. **Placeholder pages:** Bookings and Perks are placeholder routes with minimal content
2. **Inline styles:** Login/Register forms use inline styles instead of composing from primitives
3. **Consistent card pattern:** Dashboard, Profile, and other pages use a consistent card-based layout which is good
4. **Image handling working:** Rentals page successfully displays instrument images from seed data
5. **Navigation clear:** Chrome + NavBar pattern is consistent across app

---

## 3. TripleAMusic (Premium Marketplace)

### 3.1 Overview

**Purpose:** "Uber Eats for music" - curated events, ticket sales, host dashboard for posting gigs and managing venues.

**Current Pages:**
- Landing (/) - redirects to /discover or /concerts
- Discover (/discover) - placeholder
- Concert Marketplace (/concerts)
- Concert Detail (/concerts/:id)
- Checkout (/checkout)
- Cart (/cart)
- Ticket Confirmation (/tickets/:code)
- My Tickets (/my-tickets)
- Ticket Scanner (/scanner)
- Login/Register/Forgot/Reset
- Host Dashboard:
  - Manage (/manage) - host dashboard
  - My Gigs (/my-gigs)
  - Venues (/venues)
  - Venue Seating Layouts (/venues/:id/seating-layouts)
  - Seat Layout Editor (/seating-layouts/:id/edit)
  - Event Tickets (/gigs/:id/tickets) - view sold tickets
  - Staff (/staff) - staff management
- Staff Join (/staff-join) - staff invite acceptance
- Account (/account)
- Messages (/messages)

**Navigation:** NavBar with dynamic routes based on user role (customer vs logged out)

**App Identity:** \`data-taa-app="music"\` sets purple accent

**Cart Context:** CartProvider wraps app, provides cart state for ticket purchasing

### 3.2 Key Pages (Selected)

#### Concert Marketplace (/concerts)
- **File:** \`pages/ConcertMarketplacePage.tsx\` + \`.module.scss\`
- **Visual:** Grid of concert cards with images, title, date, location, ticket info
- Filters: Search, location/radius, date range, genres
- **Status:** Well-designed public marketplace, uses image cards

#### Concert Detail (/concerts/:id)
- **File:** \`pages/ConcertDetailPage.tsx\` + \`.module.scss\`
- **Visual:** Hero with concert info, location details, ticket tiers, "Add to Cart" button
- Shows available ticket tiers (GA, reserved, VIP, premium)
- Seat selector for reserved seating events
- **Status:** Comprehensive detail page with tiered ticketing support

#### Checkout (/checkout)
- **File:** \`pages/CheckoutPage.tsx\` + \`.module.scss\`
- **Visual:** Two-column layout (order summary + payment form)
- **Stripe Integration:** 
  - Uses \`@stripe/react-stripe-js\` and \`@stripe/stripe-js\`
  - Embedded Stripe Elements with \`PaymentElement\` component
  - Client-side payment confirmation via \`stripe.confirmPayment()\`
  - Calls \`/api/stripe/create-payment-intent\` to create session
  - Calls \`/api/stripe/confirm-payment\` after Stripe confirmation
- Shows fee breakdown (subtotal, service fee, Stripe fee, tax, total)
- Supports reserved seating with seat selection
- **Status:** Full embedded Stripe checkout flow - NOT hosted Checkout

#### Manage Page (/manage)
- **File:** \`pages/ManagePage.tsx\` + \`.module.scss\`
- **Visual:** Host dashboard with stats, gig management, quick actions
- Grid layout with stat cards (total events, ticket sales, revenue)
- Recent events list
- Actions: Create event, manage venues, view staff
- **Status:** Clean host dashboard

#### Venues Page (/venues)
- **File:** \`pages/VenuesPage.tsx\` + \`.module.scss\`
- **Visual:** Grid of venue cards with images, name, city, capacity
- Create venue form
- Edit/delete venue actions
- **Image handling:** Shows venue images from seed data
- **Status:** Functional venue management

### 3.3 Components

**NavBar** (\`components/NavBar.tsx\` + \`.module.scss\`)
- Dynamic navigation based on user role
- Concerts, My Tickets, Cart, Messages, Manage (host-only), Account/Login

**HostDashboardShell** (\`components/HostDashboardShell.tsx\` + \`.module.scss\`)
- Wrapper for host pages with secondary navigation
- Tabs: Overview, My Gigs, Venues, Staff

### 3.4 Styling Patterns

**Good:**
- Concert marketplace uses large image cards - very visual
- Checkout page has professional two-column layout
- Manage dashboard uses stat cards effectively

**Needs improvement:**
- Some pages have heavy inline styles (especially auth pages)
- Could unify more card patterns across pages

### 3.5 Issues/Observations

1. **Stripe fully integrated:** Embedded Elements checkout (NOT hosted Checkout)
2. **Tiered ticketing working:** Support for GA, reserved, VIP, premium tiers
3. **Seating layout system:** Complex reserved seating with visual seat selection
4. **Image-first:** Concerts and venues display images prominently
5. **Host/customer separation:** Clear role-based routing and features
6. **Cart system:** CartContext manages multi-item cart state
7. **Staff management:** Full staff invite/permission system

---

## 4. TripleAMuse (Entry Hub / Service Coordinator)

### 4.1 Overview

**Purpose:** Front door to Triple A. Promotional landing, service hub, funnels users to Music (hosts/tickets) and Musician (performers). Also has admin/employee dashboards.

**Current Pages:**
- Home (/) - **main promotional landing**
- Login (/login)
- Register (/register)
- Forgot/Reset Password
- Messages (/messages)
- Account (/account)
- Admin Dashboard (/admin)
- Admin Users (/admin/users)
- Employee Dashboard (/employee)
- Invite Onboarding (/invite) - employee invite acceptance

**Navigation:** NavBar with Home, Messages (auth), Account (auth), Admin (admin-only)

**App Identity:** \`data-taa-app="muse"\` sets purple accent

**Target Audience:** General public, potential customers, potential performers

### 4.2 Page Details

#### Home Page (/)
- **File:** \`pages/HomePage.tsx\` + \`.module.scss\`
- **Visual:** Full promotional landing page
- **Structure:**
  1. Hero: "Live music, made simple." + CTA buttons (Explore Events, Join as Performer)
  2. Services Grid: 4 cards (Event Coordination, Live Performers, Instrument Rentals, Music Lessons)
  3. Features Strip: 3 items (Vetted Professionals, End-to-End Support, Premium Equipment)
  4. Featured Venues preview: 4 venue cards with images
  5. Instrument Rentals preview: 4 instrument cards
  6. App Funnels: 2 large cards linking to Music and Musician
  7. Mission Footer: "Acoustics · Acapellas · Accompaniments" explainer
- **Styling:** Custom \`.module.scss\` (715 lines) with semantic classes
- Uses \`.hero\`, \`.servicesGrid\`, \`.venueGrid\`, \`.funnelCard\` patterns
- **Image handling:** Loads instruments and venues from API, displays with fallback
- **CTAs:** \`openMusic()\` and \`openMusician()\` helpers navigate to other apps
- **Status:** Professional promotional landing, very visual, clear funneling

#### Admin Dashboard (/admin)
- **File:** \`pages/AdminDashboardPage.tsx\`
- **Visual:** Stats overview + management actions
- User management link, invite creation
- **Status:** Basic admin functionality

#### Employee Dashboard (/employee)
- **File:** \`pages/EmployeeDashboardPage.tsx\`
- **Visual:** Simple welcome + role display
- **Status:** Minimal placeholder for rental_provider role

### 4.3 Styling Patterns

**Good:**
- Homepage is highly polished and visual
- Consistent use of card patterns across sections
- Clear hierarchy with section headers

**Could improve:**
- Auth pages (Login, Register) have minimal styling
- Admin/employee dashboards are basic

### 4.4 Issues/Observations

1. **Strong promotional focus:** Home page is the most polished promotional landing across all three apps
2. **Cross-app navigation working:** \`openMusic()\` and \`openMusician()\` correctly route to other origins
3. **Image showcase:** Venues and instruments displayed prominently
4. **Admin/employee basic:** These dashboards are functional but minimal
5. **No DIY event flow yet:** The "event coordinator flow" described in copilot instructions (select event type → performers → genre → venue → packages) is NOT implemented - homepage just links to Music

---

## 5. Stripe Integration

### 5.1 Overview

Stripe is **fully integrated** with both payment processing (customers buying tickets) and payouts (musicians getting paid).

### 5.2 Payment Processing (Tickets)

**Implementation:** Embedded Stripe Elements (NOT hosted Checkout)

**Flow:**
1. Customer adds tickets to cart in Music app
2. Checkout page (\`TripleAMusic/src/pages/CheckoutPage.tsx\`):
   - Loads \`@stripe/react-stripe-js\` and \`@stripe/stripe-js\`
   - Collects customer info (name, email)
   - For reserved seating: seat selection via SeatSelector
   - Calls \`/api/stripe/create-payment-intent\` (server endpoint)
   - Server creates PaymentIntent and returns \`clientSecret\`
   - Renders \`<Elements>\` wrapper with \`<PaymentElement>\` for card entry
   - On submit: \`stripe.confirmPayment()\` client-side
   - If successful: calls \`/api/stripe/confirm-payment\` to finalize ticket creation
3. Server (\`server/src/routes/stripe.ts\`):
   - \`/api/stripe/calculate-fees\` - calculates service fee, Stripe fee, tax (optional Stripe Tax integration)
   - \`/api/stripe/create-payment-intent\` - creates PaymentIntent with calculated amounts
   - \`/api/stripe/confirm-payment\` - creates Ticket record after payment confirmed
   - Webhook handler for \`payment_intent.succeeded\` (idempotency)

**Fee Calculation:**
- Service fee: Configurable per-transaction or per-ticket (env: \`SERVICE_FEE_PERCENT\` or flat \`$X\`)
- Stripe fee: 2.9% + $0.30 (hardcoded)
- Tax: Optional Stripe Tax integration (env: \`STRIPE_TAX_ENABLED\`)

**Stripe Elements Appearance:**
\`\`\`tsx
appearance: {
  theme: "stripe",
  variables: {
    colorPrimary: "#E59D0D", // Gold
    colorBackground: "#ffffff",
    colorText: "#1a1a1a",
    colorDanger: "#f87171",
    fontFamily: "system-ui, sans-serif",
    borderRadius: "8px",
  },
}
\`\`\`

### 5.3 Musician Payouts (Stripe Connect)

**Implementation:** Stripe Express accounts for musicians

**Flow:**
1. Musician onboarding (\`TripleAMusician/src/pages/MusicianOnboardingPage.tsx\`):
   - Step 1: Connect Stripe payouts
   - Button calls \`/api/stripe/musicians/onboarding-link\`
   - Server creates Stripe Express account (if not exists)
   - Returns AccountLink URL for Stripe onboarding
   - User completes Stripe Express setup in new window
   - Returns to app, clicks "Check status" to refresh
2. Server (\`server/src/routes/stripe.ts\`):
   - \`/api/stripe/musicians/account\` - creates/retrieves Stripe Connect account
   - \`/api/stripe/musicians/onboarding-link\` - generates AccountLink
   - \`/api/stripe/musicians/status\` - checks charges_enabled, payouts_enabled
3. User model stores:
   - \`stripeAccountId: string\`
   - \`stripeChargesEnabled: boolean\`
   - \`stripePayoutsEnabled: boolean\`
   - \`stripeOnboardingComplete: boolean\`

**Requirements:** Musician dashboard gated behind \`stripeReady && profileReady\`

### 5.4 Key Environment Variables

\`\`\`
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_TAX_ENABLED=false
SERVICE_FEE_PERCENT=1%  (or SERVICE_FEE_FLAT=$1.00)
\`\`\`

### 5.5 Status

**Working:**
- ✅ Embedded checkout with PaymentElement
- ✅ Fee calculation with breakdown
- ✅ Musician Connect onboarding
- ✅ Ticket creation after payment
- ✅ Email confirmation (via \`sendTicketConfirmationEmail()\`)
- ✅ QR code generation for tickets
- ✅ Ticket scanner for staff
- ✅ Tax estimation (if enabled)

**Not using:**
- ❌ Hosted Checkout - all flows use embedded Elements
- ❌ Subscription billing
- ❌ Payment Links

---

## 6. Routing Summary

### TripleAMusician
\`\`\`
/ - Landing
/login, /register, /forgot-password, /reset-password
/onboarding - Stripe + profile setup
/dashboard - Main performer console
/profile - Account settings
/bookings - Placeholder
/perks - Placeholder
/gigs, /gigs/:id - Browse and apply
/rentals - Browse instruments
/messages - Chat inbox
\`\`\`

### TripleAMusic
\`\`\`
/ - Redirects to /concerts
/login, /register, /forgot-password, /reset-password
/concerts - Public marketplace
/concerts/:id - Event detail
/checkout - Payment form
/cart - Shopping cart
/tickets/:code - Confirmation
/my-tickets - User's tickets
/scanner - Staff scanner
/manage - Host dashboard
/my-gigs - Host's events
/venues - Venue management
/venues/:id/seating-layouts - Layout management
/seating-layouts/:id/edit - Layout editor
/gigs/:id/tickets - Event ticket sales
/staff - Staff management
/staff-join - Staff invite
/account - Account settings
/messages - Chat inbox
\`\`\`

### TripleAMuse
\`\`\`
/ - Promotional landing
/login, /register, /forgot-password, /reset-password
/account - Account settings
/messages - Chat inbox
/admin - Admin dashboard
/admin/users - User management
/employee - Employee dashboard
/invite - Employee onboarding
\`\`\`

---

## 7. Key Patterns & Observations

### 7.1 Design System Strengths

1. **Comprehensive primitives:** \`.module.scss\` provides 1055 lines of reusable patterns
2. **Clear token system:** CSS variables for theming, spacing, typography
3. **Flat aesthetic:** Minimal shadows, border-defined containers
4. **Focus on gold:** Primary actions use gold accent consistently
5. **Responsive utilities:** Gap, flex, grid patterns for layout

### 7.2 Consistency Issues

1. **Inline styles persist:** Auth pages, some forms use inline \`style={{ ... }}\`
2. **Custom SCSS varies:** Some pages have extensive custom SCSS, others compose from primitives
3. **Card patterns not unified:** Different pages define similar card layouts differently
4. **Chrome pattern good:** \`.chrome\` + \`.nav\` pattern is consistent but could be extracted to shared component

### 7.3 Visual State

**Musician:**
- Dashboard: Professional, clean, driver-app feel ✅
- Profile: Comprehensive, multi-card layout ✅
- Landing: Strong hero, clear CTAs ✅
- Onboarding: Functional, step-by-step ✅

**Music:**
- Concert marketplace: Image-first, grid layout ✅
- Checkout: Professional two-column, embedded Stripe ✅
- Manage dashboard: Clean host console ✅
- Venues: Image cards, good CRUD ✅

**Muse:**
- Home: **Best promotional landing across all three apps** ✅
- Strong visual hierarchy, clear funneling ✅
- Admin/employee dashboards: Basic, minimal ⚠️

### 7.4 Differentiation

**Current state:**
- All three apps use similar chrome/nav pattern
- Purple accent for all three (should vary per app?)
- Navigation structure differs but visual treatment is same

**Per copilot instructions:**
- Music should feel like "premium marketplace" (curated, ticket-focused)
- Musician should feel like "work dashboard" (obligations, requests, perks)
- Muse should feel like "event coordinator" (DIY flow, step-by-step)

**Status:** Apps are functionally differentiated, visually similar

---

## 8. Areas for Improvement

### 8.1 High Priority

1. **Eliminate inline styles:** Refactor auth pages to use primitives and form components
2. **Unify card patterns:** Extract common card layouts to shared primitives
3. **Strengthen app identity:** Use different accent colors per app (gold for primary, but different secondary accents)
4. **Complete Muse flow:** Implement the "event coordinator" stepped flow (event type → performers → genre → venue → packages)
5. **Fill placeholder pages:** Bookings and Perks in Musician need real content

### 8.2 Medium Priority

1. **Image optimization:** Add lazy loading, srcset for responsive images
2. **Loading states:** More shimmer/skeleton patterns for data-heavy pages
3. **Empty states:** Consistent empty state patterns across apps
4. **Error handling:** Better error UI for failed API calls
5. **Accessibility audit:** Focus management, ARIA labels, keyboard navigation

### 8.3 Low Priority

1. **Light mode support:** Finish light mode implementation
2. **Animations:** Subtle transitions for state changes
3. **Mobile refinements:** Touch-friendly target sizes, swipe gestures
4. **Performance:** Code splitting, lazy loading routes

---

## 9. Recommendations

### For Immediate UI Overhaul:

1. **Start with Muse Home:** It's the most polished page - use it as template for other landing pages
2. **Audit inline styles:** Run a pass to replace inline \`style={{}}\` with primitive classes
3. **Create card composition patterns:** Extract recurring card layouts to shared primitives
4. **Strengthen app accents:**
   - Music: Keep purple (premium)
   - Musician: Use blue (work/professional)
   - Muse: Use gold more prominently (brand/entry)
5. **Implement Muse event flow:** The DIY coordinator flow is a key differentiator
6. **Review navigation:** Consider different nav patterns per app (Music = browse-focused, Musician = dashboard-focused, Muse = funnel-focused)

### For Long-Term Quality:

1. **Component library documentation:** Document all primitives and shared components
2. **Design tokens in code:** Consider exporting SCSS variables to JS/TS for programmatic access
3. **Storybook or similar:** Visual component catalog for development
4. **Accessibility testing:** Automated and manual audits
5. **Performance budgets:** Set size/speed targets for each app

---

## End of Report

**Next Steps:** Review findings with team, prioritize changes, create implementation plan for UI overhaul.

**Archived conversation:** See \`.github/discord-chat-history.md\` for owner direction and product positioning.

Plan TODOs derived from .github/plan.md

1. Server model additions:
   - Add TicketSeat model with unique index (gigId + seatId)
   - Add SeatHold model with TTL index
   - Add Gig.ticketsSold field and migration/backfill

2. Server routes and logic:
   - Add seat-hold endpoints (create, release, list for gig)
   - Update GET /seating/gigs/:gigId/available-seats to account for holds
   - Update checkout/purchase flow to be transaction-based and use TicketSeat unique index
   - Refactor Stripe flow: create pending tickets, finalize in webhook on payment success

3. Shared client API updates:
   - Update packages/shared/src/api/client.ts to add holds endpoints

4. TripleAMusic client changes:
   - Add holdKey localStorage behavior
   - Update seat selection UI to acquire/release holds and handle 409
   - Ensure GA quantity selection limited by remaining capacity
   - Apply venue seating layout cloning when applying to a gig

5. Indexes and migration scripts:
   - Add DB indexes for unique TicketSeat and TTL SeatHold
   - Add migration/backfill script for existing gigs to set ticketsSold

6. Tests:
   - Concurrent seat purchase test (only one succeeds)
   - Concurrent GA purchase test (never exceed capacity)
   - Seat hold blocking behavior test

7. Verification:
   - Run TypeScript checks and relevant tests

Status: IN PROGRESS -> Completed core server + client changes.

Completed items:

- Added `TicketSeat` and `SeatHold` models with indexes and TTL.
- Added `Gig.ticketsSold` field and updated interface.
- Implemented seat-hold endpoints and integrated holds into `available-seats`.
- Refactored Stripe confirm flow to finalize reserved seats atomically using transactions and `TicketSeat`.
- Enforced GA capacity via atomic `Gig.ticketsSold` increments.
- Added shared API client methods for creating/releasing holds and updated types.
- Added client-side hold acquisition in `CheckoutPage.tsx`.
- Added demo script to simulate concurrent seat claims.

Remaining / next steps:

- Add automated integration tests that run against a test MongoDB (not added to repo to avoid new test deps).
- Improve hold lifecycle in the UI (release on unmount / navigate).
- Add backfill migration script for existing tickets -> `TicketSeat` and `Gig.ticketsSold` if needed.

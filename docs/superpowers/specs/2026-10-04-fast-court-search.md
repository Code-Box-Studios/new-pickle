# Faster, easier court search

User request: make court searching very easy and fast, from the current four-field bar.

Keep location + date + Find courts as the primary action. Provide Today, Tomorrow and This weekend quick date buttons using Philippine civil dates. Show the selected time/duration in a compact summary, with shadcn Collapsible optional controls, and a clear reset action. Open those controls for nondefault URL filters. Keep nationwide searchable city picker, custom calendar, accessible labels, keyboard support and touch targets.

Server results stream inside Suspense with the existing two-paddle Pikol loader, so the search form stays available while availability is calculated. Remount form from normalized URL values so Back/Forward does not retain stale input. Batch local court schedules/exceptions/bookings once per result set rather than repeating reads per court. Keep external Sentry availability delegated to its existing backend. No availability caching beyond existing TTL and no weakened booking revalidation.

Verify quick dates around Philippine midnight/weekends, URL navigation and preserved optional filters, reduced local query fanout with real Postgres, confirmed bookings/venue and court blocks/expired holds/duration/indoor filtering, connected Sentry behavior via existing tests, and mobile/desktop overflow in the browser. Publish with payment preparation after the shared full suite and review.

// Temporary homepage — replaced with the real hero + search + featured venues
// in Phase 4. Kept minimal so the shell builds during Phase 3.
export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
        RallyPoint
      </p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink">
        Find your next game.
      </h1>
      <p className="mt-3 text-muted">Marketplace search arrives in Phase 4.</p>
    </section>
  );
}

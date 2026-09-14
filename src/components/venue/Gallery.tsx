export function Gallery({ photos, name }: { photos: string[]; name: string }) {
  if (photos.length === 0) {
    return (
      <div className="grid aspect-[16/9] w-full place-items-center rounded-b-3xl bg-slate-100 text-muted sm:rounded-2xl">
        No photos yet
      </div>
    );
  }
  const [hero, ...rest] = photos;
  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero}
        alt={name}
        className="aspect-[16/10] w-full rounded-b-3xl object-cover sm:aspect-auto sm:h-full sm:rounded-2xl"
      />
      {rest.length > 0 && (
        <div className="hidden grid-rows-2 gap-2 sm:grid">
          {rest.slice(0, 2).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={p}
              alt={`${name} photo ${i + 2}`}
              className="h-full w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

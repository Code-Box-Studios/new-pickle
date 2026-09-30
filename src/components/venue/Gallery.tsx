export function Gallery({ photos, name }: { photos: string[]; name: string }) {
  if (photos.length === 0) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-b-[20px] bg-mist text-sm text-muted sm:rounded-2xl">
        No photos yet
      </div>
    );
  }
  const [hero] = photos;
  return (
    <div className="court-photo-frame relative overflow-hidden rounded-b-[20px] sm:rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero}
        alt={name}
        className="court-photo-image aspect-[4/3] w-full object-cover"
      />
      {photos.length > 1 && (
        <span className="absolute bottom-3 left-3 rounded-lg border border-white/15 bg-ink/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          1 / {photos.length}
        </span>
      )}
    </div>
  );
}

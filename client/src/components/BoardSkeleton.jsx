export default function BoardSkeleton() {
  return (
    <div className="space-y-7">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-panel p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="skeleton-shimmer row-span-2 h-40 rounded-2xl" />
              <div className="skeleton-shimmer h-20 rounded-2xl" />
              <div className="skeleton-shimmer h-20 rounded-2xl" />
            </div>
            <div className="skeleton-shimmer mt-4 h-5 w-2/3 rounded-full" />
            <div className="skeleton-shimmer mt-3 h-4 w-full rounded-full" />
          </div>
        ))}
      </section>
      <section className="columns-1 gap-4 sm:columns-2 xl:columns-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="mb-4 break-inside-avoid rounded-[1.6rem] bg-white/50 p-3 shadow-sm ring-1 ring-white/70">
            <div className={`skeleton-shimmer rounded-[1.25rem] ${index % 2 ? "h-80" : "h-96"}`} />
            <div className="skeleton-shimmer mt-4 h-5 w-3/4 rounded-full" />
            <div className="skeleton-shimmer mt-3 h-4 w-full rounded-full" />
            <div className="skeleton-shimmer mt-2 h-4 w-1/2 rounded-full" />
          </div>
        ))}
      </section>
    </div>
  );
}

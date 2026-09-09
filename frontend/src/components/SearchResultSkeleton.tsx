export function SearchResultSkeleton() {
  return (
    <div
      className="flex animate-pulse gap-4 rounded-lg border border-gray-200 bg-white p-4"
      aria-hidden="true"
    >
      <div className="h-20 w-20 shrink-0 rounded-md bg-gray-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex justify-between gap-2">
          <div className="h-5 w-2/3 rounded bg-gray-200" />
          <div className="h-5 w-10 rounded-full bg-gray-200" />
        </div>
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-4/5 rounded bg-gray-200" />
        <div className="flex gap-1 pt-1">
          <div className="h-5 w-14 rounded bg-gray-200" />
          <div className="h-5 w-12 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function SearchResultsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Загрузка результатов поиска">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <SearchResultSkeleton />
        </li>
      ))}
    </ul>
  );
}

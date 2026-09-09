export function ItemCardSkeleton() {
  return (
    <div
      className="flex animate-pulse flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      aria-hidden="true"
    >
      <div className="aspect-[4/3] w-full bg-gray-200" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="h-5 w-3/4 rounded bg-gray-200" />
        <div className="flex gap-1">
          <div className="h-5 w-12 rounded-full bg-gray-200" />
          <div className="h-5 w-16 rounded-full bg-gray-200" />
        </div>
        <div className="mt-auto h-3 w-20 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export function CatalogGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <ItemCardSkeleton key={index} />
      ))}
    </div>
  );
}

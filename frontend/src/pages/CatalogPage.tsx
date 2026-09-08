import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ItemCard } from '../components/ItemCard';
import { useItems } from '../hooks/useItems';

function Spinner() {
  return (
    <div
      className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
      role="status"
      aria-label="Загрузка"
    />
  );
}

export function CatalogPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useItems(page);

  if (isLoading) {
    return (
      <section>
        <h2 className="mb-6 text-2xl font-semibold">Каталог</h2>
        <div className="flex items-center gap-3 text-gray-700">
          <Spinner />
          <p>Загрузка каталога…</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section>
        <h2 className="mb-6 text-2xl font-semibold">Каталог</h2>
        <p className="text-red-600" role="alert">
          {error instanceof Error ? error.message : 'Не удалось загрузить каталог'}
        </p>
      </section>
    );
  }

  const items = data?.items ?? [];
  const meta = data?.meta;

  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-6 text-2xl font-semibold">Каталог</h2>
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="mb-4 text-gray-600">Каталог пуст. Загрузите первый объект.</p>
          <Link
            to="/upload"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Загрузить
          </Link>
        </div>
      </section>
    );
  }

  const totalPages = meta?.totalPages ?? 1;
  const currentPage = meta?.page ?? page;

  return (
    <section>
      <h2 className="mb-6 text-2xl font-semibold">Каталог</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <ItemCard key={item._id} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
          aria-label="Пагинация каталога"
        >
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={currentPage <= 1}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Назад
          </button>
          <span className="text-sm text-gray-600">
            Страница {currentPage} из {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Вперёд
          </button>
        </nav>
      )}
    </section>
  );
}

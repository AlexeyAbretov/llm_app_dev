import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { CatalogGridSkeleton } from '../components/ItemCardSkeleton';
import { ItemCard } from '../components/ItemCard';
import { TagFilter } from '../components/TagFilter';
import { useItems } from '../hooks/useItems';
import { useTags } from '../hooks/useTags';

export function CatalogPage() {
  const [page, setPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { data: tagsData } = useTags();
  const { data, isLoading, isError, error } = useItems(page, selectedTags);

  const toggleTag = useCallback((tag: string) => {
    setPage(1);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const clearTags = useCallback(() => {
    setPage(1);
    setSelectedTags([]);
  }, []);

  const addTagToFilter = useCallback((tag: string) => {
    setPage(1);
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);

  if (isLoading) {
    return (
      <section aria-busy="true" aria-label="Загрузка каталога">
        <h2 className="mb-6 text-2xl font-semibold">Каталог</h2>
        <CatalogGridSkeleton />
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
  const availableTags = tagsData?.tags ?? [];

  if (items.length === 0 && selectedTags.length === 0 && (meta?.total ?? 0) === 0) {
    return (
      <section>
        <h2 className="mb-6 text-2xl font-semibold">Каталог</h2>
        <TagFilter
          tags={availableTags}
          selectedTags={selectedTags}
          onToggleTag={toggleTag}
          onClear={clearTags}
        />
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
      <TagFilter
        tags={availableTags}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        onClear={clearTags}
      />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="mb-4 text-gray-600">По выбранным тегам ничего не найдено.</p>
          <button
            type="button"
            onClick={clearTags}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Сбросить фильтр
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ItemCard key={item._id} item={item} onTagClick={addTagToFilter} />
          ))}
        </div>
      )}

      {totalPages > 1 && items.length > 0 && (
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

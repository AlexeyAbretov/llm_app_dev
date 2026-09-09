import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchResultsSkeleton } from '../components/SearchResultSkeleton';
import { useSearch } from '../hooks/useSearch';
import type { SearchResultItem } from '../types';

const DEBOUNCE_MS = 300;

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function SearchResultRow({ result }: { result: SearchResultItem }) {
  const { item, score } = result;

  return (
    <Link
      to={`/items/${item._id}`}
      className="flex gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title || 'Объект каталога'}
          className="h-20 w-20 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
          Нет фото
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900">
            {item.title || 'Без названия'}
          </h3>
          <span
            className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
            title="Релевантность"
          >
            {formatScore(score)}
          </span>
        </div>
        {item.description ? (
          <p className="line-clamp-2 text-sm text-gray-600">{item.description}</p>
        ) : null}
        {item.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => setDebouncedQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError, error } = useSearch(debouncedQuery);

  const showIdle = debouncedQuery.length === 0;
  const showEmpty = !showIdle && !isLoading && !isError && data?.results.length === 0;

  return (
    <section>
      <h2 className="mb-2 text-2xl font-semibold">Поиск</h2>
      <p className="mb-6 text-gray-600">
        Текстовый поиск по заголовку, описанию и тегам объектов каталога.
      </p>

      <label htmlFor="search-input" className="sr-only">
        Поиск по каталогу
      </label>
      <input
        id="search-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Поиск по каталогу…"
        className="mb-6 w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        autoComplete="off"
      />

      {showIdle ? (
        <p className="text-gray-500">Введите запрос для поиска по каталогу.</p>
      ) : null}

      {isLoading ? <SearchResultsSkeleton /> : null}

      {isError ? (
        <p className="text-red-600">
          {error instanceof Error ? error.message : 'Ошибка поиска'}
        </p>
      ) : null}

      {showEmpty ? (
        <p className="text-gray-500">Ничего не найдено.</p>
      ) : null}

      {data && data.results.length > 0 ? (
        <ul className="space-y-3">
          {data.results.map((result) => (
            <li key={result.item._id}>
              <SearchResultRow result={result} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

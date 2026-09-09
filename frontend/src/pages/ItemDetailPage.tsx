import { Link, useParams } from 'react-router-dom';
import { ApiClientError } from '../api/client';
import { UserTagsEditor } from '../components/UserTagsEditor';
import { useItem } from '../hooks/useItem';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function Spinner() {
  return (
    <div
      className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
      role="status"
      aria-label="Загрузка"
    />
  );
}

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading, isError, error } = useItem(id);

  return (
    <section>
      <Link to="/" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← Назад в каталог
      </Link>

      {isLoading && (
        <div className="flex items-center gap-3 text-gray-700">
          <Spinner />
          <p>Загрузка объекта…</p>
        </div>
      )}

      {isError && (
        <p className="text-red-600" role="alert">
          {error instanceof ApiClientError && error.status === 404
            ? 'Объект не найден'
            : error instanceof Error
              ? error.message
              : 'Не удалось загрузить объект'}
        </p>
      )}

      {item && (
        <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title || 'Объект каталога'}
              className="max-h-[70vh] w-full bg-gray-50 object-contain"
            />
          ) : (
            <div className="flex h-64 items-center justify-center bg-gray-100 text-gray-400">
              Нет фото
            </div>
          )}
          <div className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              {item.title || 'Без названия'}
            </h2>
            {item.description && (
              <p className="whitespace-pre-wrap text-gray-700">{item.description}</p>
            )}
            {item.tags.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">Теги LLM</h3>
                <ul className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">Ваши теги</h3>
              <UserTagsEditor
                itemId={item._id}
                userTags={item.userTags ?? []}
                llmTags={item.tags}
                status={item.status}
              />
            </div>
            <p className="text-sm text-gray-500">
              Добавлено:{' '}
              <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
            </p>
          </div>
        </article>
      )}
    </section>
  );
}

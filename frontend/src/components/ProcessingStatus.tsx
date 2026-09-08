import { useItem } from '../hooks/useItem';

interface ProcessingStatusProps {
  itemId: string;
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

export function ProcessingStatus({ itemId }: ProcessingStatusProps) {
  const { data: item, isLoading, isError, error } = useItem(itemId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-6">
        <Spinner />
        <p className="text-gray-700">Загрузка статуса…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
        {error instanceof Error ? error.message : 'Не удалось получить статус обработки'}
      </div>
    );
  }

  if (!item) {
    return null;
  }

  if (item.status === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-6">
        <Spinner />
        <p className="text-gray-700">Ожидание обработки…</p>
      </div>
    );
  }

  if (item.status === 'processing') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-6">
        <Spinner />
        <p className="text-gray-700">Обработка LLM…</p>
      </div>
    );
  }

  if (item.status === 'failed') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
        {item.error ?? 'Не удалось обработать изображение'}
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.title || 'Объект каталога'}
          className="max-h-80 w-full object-contain bg-gray-50"
        />
      )}
      <div className="space-y-3 p-6">
        <h3 className="text-xl font-semibold text-gray-900">
          {item.title || 'Без названия'}
        </h3>
        {item.description && (
          <p className="text-gray-700">{item.description}</p>
        )}
        {item.tags.length > 0 && (
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
        )}
      </div>
    </article>
  );
}

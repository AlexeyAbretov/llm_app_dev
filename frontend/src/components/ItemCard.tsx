import { Link } from 'react-router-dom';
import type { CatalogItemPublic } from '../types';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(iso));
}

interface ItemCardProps {
  item: CatalogItemPublic;
}

export function ItemCard({ item }: ItemCardProps) {
  const title = item.title || 'Без названия';
  const visibleTags = item.tags.slice(0, 5);

  return (
    <Link
      to={`/items/${item._id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={title}
          className="aspect-[4/3] w-full object-cover bg-gray-50"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-gray-100 text-sm text-gray-400">
          Нет фото
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold text-gray-900 group-hover:text-blue-700">
          {title}
        </h3>
        {visibleTags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        <time className="mt-auto text-xs text-gray-500" dateTime={item.createdAt}>
          {formatDate(item.createdAt)}
        </time>
      </div>
    </Link>
  );
}

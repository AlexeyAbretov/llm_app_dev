import { Link, useParams } from 'react-router-dom';

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <section>
      <Link to="/" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← Назад в каталог
      </Link>
      <h2 className="mb-2 text-2xl font-semibold">Объект</h2>
      <p className="text-gray-600">
        Карточка объекта <span className="font-mono text-sm">{id}</span> — этап 8.
      </p>
    </section>
  );
}

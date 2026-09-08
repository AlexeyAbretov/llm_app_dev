import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api/items';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-blue-100 text-blue-800'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  ].join(' ');

function HealthBadge() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
        API…
      </span>
    );
  }

  if (isError || !data) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
        API недоступен
      </span>
    );
  }

  const ok = data.status === 'ok' && data.mongo && data.ollama;

  return (
    <span
      className={[
        'rounded-full px-2 py-1 text-xs',
        ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800',
      ].join(' ')}
      title={`MongoDB: ${data.mongo ? 'ok' : 'нет'}, Ollama: ${data.ollama ? 'ok' : 'нет'}`}
    >
      {ok ? 'Система готова' : 'Частичная деградация'}
    </span>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Каталог объектов</h1>
            <HealthBadge />
          </div>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Каталог
            </NavLink>
            <NavLink to="/upload" className={navLinkClass}>
              Загрузить
            </NavLink>
            <NavLink to="/search" className={navLinkClass}>
              Поиск
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

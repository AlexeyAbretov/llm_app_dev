import type { ApiError } from '../types';

/** В dev Vite проксирует /api → http://localhost:3001 */
export const API_BASE_URL = '/api';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    if (body.error) {
      return body.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return response.statusText || 'Неизвестная ошибка';
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new ApiClientError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, body?: BodyInit, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body,
    ...init,
  });
}

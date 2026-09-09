import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MAX_USER_TAGS, slugifyTag } from '@llm-app/shared';
import { ApiClientError } from '../api/client';
import { updateUserTags } from '../api/items';
import type { GetItemResponse } from '../types';

interface UserTagsEditorProps {
  itemId: string;
  userTags: string[];
  llmTags: string[];
  status: GetItemResponse['status'];
}

export function UserTagsEditor({ itemId, userTags, llmTags, status }: UserTagsEditorProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (nextTags: string[]) => updateUserTags(itemId, nextTags),
    onSuccess: (updated) => {
      queryClient.setQueryData(['item', itemId], updated);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось обновить теги',
      );
    },
  });

  if (status !== 'ready') {
    return (
      <p className="text-sm text-gray-500">
        Пользовательские теги будут доступны после завершения обработки.
      </p>
    );
  }

  const preview = slugifyTag(input);
  const canAdd =
    preview.length > 0 &&
    userTags.length < MAX_USER_TAGS &&
    !userTags.includes(preview) &&
    !llmTags.some((tag) => tag.toLowerCase() === preview.toLowerCase()) &&
    !mutation.isPending;

  function submitTags(nextTags: string[]) {
    mutation.mutate(nextTags);
  }

  function handleAdd() {
    if (!canAdd) {
      return;
    }
    submitTags([...userTags, preview]);
    setInput('');
  }

  function handleRemove(tag: string) {
    submitTags(userTags.filter((item) => item !== tag));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {userTags.length === 0 ? (
          <span className="text-sm text-gray-500">Пока нет пользовательских тегов</span>
        ) : (
          userTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                disabled={mutation.isPending}
                className="rounded-full px-1 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                aria-label={`Удалить тег ${tag}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Новый тег…"
          disabled={mutation.isPending || userTags.length >= MAX_USER_TAGS}
          className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Добавить
        </button>
        <span className="text-xs text-gray-500">
          {userTags.length}/{MAX_USER_TAGS}
        </span>
      </div>

      {preview && preview !== input.trim().toLowerCase() ? (
        <p className="text-xs text-gray-500">Будет сохранено как: {preview}</p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

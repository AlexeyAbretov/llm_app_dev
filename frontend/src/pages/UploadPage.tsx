import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createItem } from '../api/items';
import { ApiClientError } from '../api/client';
import { ImageUpload } from '../components/ImageUpload';
import { ProcessingStatus } from '../components/ProcessingStatus';
import { useItem } from '../hooks/useItem';

export function UploadPage() {
  const queryClient = useQueryClient();
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: item } = useItem(uploadedId ?? undefined);
  const invalidatedReadyIds = useRef(new Set<string>());

  useEffect(() => {
    if (
      uploadedId &&
      item?.status === 'ready' &&
      !invalidatedReadyIds.current.has(uploadedId)
    ) {
      invalidatedReadyIds.current.add(uploadedId);
      queryClient.invalidateQueries({ queryKey: ['items'] });
    }
  }, [uploadedId, item?.status, queryClient]);

  const uploadMutation = useMutation({
    mutationFn: createItem,
    onSuccess: (data) => {
      setUploadedId(data.id);
      setUploadError(null);
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        setUploadError(error.message);
      } else {
        setUploadError('Не удалось загрузить файл');
      }
    },
  });

  const handleUpload = (file: File) => {
    setUploadError(null);
    uploadMutation.mutate(file);
  };

  const handleUploadAnother = () => {
    if (uploadedId) {
      queryClient.removeQueries({ queryKey: ['item', uploadedId] });
    }
    setUploadedId(null);
    setUploadError(null);
    uploadMutation.reset();
  };

  const isTerminal =
    item?.status === 'ready' || item?.status === 'failed';

  const renderUploadAnotherButton = () => (
    <button
      type="button"
      onClick={handleUploadAnother}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      Загрузить ещё
    </button>
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold">Загрузка</h2>
        <p className="text-gray-600">
          Загрузите фото объекта — система автоматически создаст описание на русском языке.
        </p>
      </div>

      {!uploadedId && (
        <ImageUpload onUpload={handleUpload} disabled={uploadMutation.isPending} />
      )}

      {uploadError && (
        <p className="text-sm text-red-600" role="alert">
          {uploadError}
        </p>
      )}

      {uploadMutation.isPending && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-6">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
            role="status"
            aria-label="Отправка"
          />
          <p className="text-gray-700">Отправка файла…</p>
        </div>
      )}

      {uploadedId && isTerminal && renderUploadAnotherButton()}

      {uploadedId && <ProcessingStatus itemId={uploadedId} />}

      {uploadedId && isTerminal && renderUploadAnotherButton()}
    </section>
  );
}

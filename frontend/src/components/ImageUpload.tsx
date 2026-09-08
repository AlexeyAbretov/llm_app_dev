import { useCallback, useEffect, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
} as const;

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface ImageUploadProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
  onReset?: () => void;
}

export function ImageUpload({ onUpload, disabled = false, onReset }: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const clearPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setValidationError(null);
  }, [previewUrl]);

  const handleReset = useCallback(() => {
    clearPreview();
    onReset?.();
  }, [clearPreview, onReset]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setValidationError(null);

      if (rejectedFiles.length > 0) {
        const firstError = rejectedFiles[0]?.errors[0];
        if (firstError?.code === 'file-too-large') {
          setValidationError('Файл слишком большой. Максимум 10 МБ.');
        } else {
          setValidationError('Допустимы только JPEG, PNG и WebP.');
        }
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        return;
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    },
    [previewUrl],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE_BYTES,
    maxFiles: 1,
    disabled,
  });

  const handleUpload = () => {
    if (!selectedFile || disabled) {
      return;
    }
    onUpload(selectedFile);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={[
          'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
            : isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-gray-700">Отпустите файл здесь…</p>
        ) : (
          <>
            <p className="text-gray-700">Перетащите фото сюда или нажмите для выбора</p>
            <p className="mt-1 text-sm text-gray-500">JPEG, PNG, WebP — до 10 МБ</p>
          </>
        )}
      </div>

      {validationError && (
        <p className="text-sm text-red-600" role="alert">
          {validationError}
        </p>
      )}

      {previewUrl && selectedFile && (
        <div className="space-y-3">
          <img
            src={previewUrl}
            alt="Предпросмотр"
            className="mx-auto max-h-64 rounded-lg border border-gray-200 object-contain"
          />
          <p className="text-center text-sm text-gray-500">{selectedFile.name}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={disabled}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Загрузить
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={disabled}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Отменить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

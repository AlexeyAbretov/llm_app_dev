interface TagFilterProps {
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClear: () => void;
}

export function TagFilter({
  tags,
  selectedTags,
  onToggleTag,
  onClear,
}: TagFilterProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Фильтр по тегам:</span>
        {selectedTags.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-blue-600 underline-offset-2 hover:underline"
          >
            Сбросить фильтр
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleTag(tag)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

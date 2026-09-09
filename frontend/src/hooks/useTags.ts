import { useQuery } from '@tanstack/react-query';
import { listTags } from '../api/items';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
    staleTime: 60_000,
  });
}

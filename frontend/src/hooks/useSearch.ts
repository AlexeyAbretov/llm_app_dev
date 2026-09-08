import { useQuery } from '@tanstack/react-query';
import { searchItems } from '../api/search';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchItems(query),
    enabled: query.length > 0,
  });
}

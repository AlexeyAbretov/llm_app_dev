import { useQuery } from '@tanstack/react-query';
import { listItems } from '../api/items';

const PAGE_SIZE = 20;

export function useItems(page: number) {
  return useQuery({
    queryKey: ['items', page],
    queryFn: () => listItems(page, PAGE_SIZE),
    staleTime: 0,
  });
}

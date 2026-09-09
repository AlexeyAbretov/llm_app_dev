import { useQuery } from '@tanstack/react-query';
import { listItems } from '../api/items';

const PAGE_SIZE = 20;

export function useItems(page: number, tags: string[] = []) {
  return useQuery({
    queryKey: ['items', page, tags],
    queryFn: () => listItems(page, PAGE_SIZE, tags.length ? tags : undefined),
    staleTime: 0,
  });
}

import { useQuery } from '@tanstack/react-query';
import { getItem } from '../api/items';
import type { ProcessingStatus } from '../types';

const POLLING_STATUSES: ProcessingStatus[] = ['pending', 'processing'];
const POLL_INTERVAL_MS = 2000;

function shouldPollStatus(status: ProcessingStatus | undefined): boolean {
  return status !== undefined && POLLING_STATUSES.includes(status);
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: ['item', id],
    queryFn: () => getItem(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return shouldPollStatus(status) ? POLL_INTERVAL_MS : false;
    },
  });
}

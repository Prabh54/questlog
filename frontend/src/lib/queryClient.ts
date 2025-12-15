import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,         // 1 min — data stays fresh
      gcTime: 1000 * 60 * 5,        // 5 min — inactive cache kept
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx)
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

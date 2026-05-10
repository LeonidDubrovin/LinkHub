import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "../types";
import { apiClient, PaginatedBookmarksResponse } from "../services/api";

const PAGE_SIZE = 30;

interface BookmarksQueryKey {
  collectionId: string | null;
  domain: string | null;
  searchQuery: string;
  sortBy: string;
  filterBy: string;
}

export function usePaginatedBookmarks(
  collectionId: string | null,
  domain: string | null,
  searchQuery: string,
  sortBy: string,
  filterBy: string,
  enabled = true
) {
  const queryKey: (string | null)[] = [
    "bookmarks",
    collectionId,
    domain,
    searchQuery,
    sortBy,
    filterBy,
  ];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.bookmarks.list({
        collectionId: collectionId || undefined,
        domain: domain || undefined,
        page: pageParam,
        limit: PAGE_SIZE,
        q: searchQuery || undefined,
        sort: sortBy,
        filter: filterBy === "all" ? undefined : filterBy,
      });
      return res;
    },
    getNextPageParam: (lastPage: PaginatedBookmarksResponse) => {
      const hasMore = lastPage.data.length === PAGE_SIZE;
      return hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled,
  });

  const bookmarks: Bookmark[] = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return {
    bookmarks,
    total,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    queryKey,
  };
}

export function usePaginatedTrash(
  searchQuery: string,
  sortBy: string,
  enabled = true
) {
  const queryKey = ["trash", searchQuery, sortBy];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.bookmarks.listTrash({
        page: pageParam,
        limit: PAGE_SIZE,
        q: searchQuery || undefined,
        sort: sortBy,
      });
      return res;
    },
    getNextPageParam: (lastPage: PaginatedBookmarksResponse) => {
      const hasMore = lastPage.data.length === PAGE_SIZE;
      return hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled,
  });

  const trashItems: Bookmark[] = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return {
    trashItems,
    total,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    queryKey,
  };
}

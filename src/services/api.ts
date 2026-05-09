import { Bookmark, Collection, Domain, Space, Tag } from "../types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    let message = "Request failed";
    try {
      const err = await res.json();
      message = err.error || message;
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export interface CreateBookmarkResult {
  success: boolean;
  exists?: boolean;
  id?: string;
  needsRefresh?: boolean;
}

export interface CategorizeResult {
  processed: number;
  total: number;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  del: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  collections: {
    list: (spaceId?: string) =>
      apiClient.get<Collection[]>(`/api/collections${spaceId ? `?spaceId=${spaceId}` : ""}`),
    create: (data: { name: string; space_id: string; icon?: string; color?: string | null; parent_id?: string | null }) =>
      apiClient.post<Collection>("/api/collections", data),
    update: (id: string, data: { name?: string; icon?: string; color?: string | null; parent_id?: string | null; sort_order?: number }) =>
      apiClient.put<Collection>(`/api/collections/${id}`, data),
    reorder: (orders: string[]) =>
      apiClient.put<{ success: boolean }>("/api/collections/reorder", { orders }),
    delete: (id: string) =>
      apiClient.del<{ success: boolean }>(`/api/collections/${id}`),
    getForBookmark: (bookmarkId: string) =>
      apiClient.get<Collection[]>(`/api/bookmarks/${bookmarkId}/collections`),
    setForBookmark: (bookmarkId: string, collectionIds: string[]) =>
      apiClient.post<{ success: boolean; collections: Collection[] }>(`/api/bookmarks/${bookmarkId}/collections`, { collectionIds }),
    removeFromBookmark: (bookmarkId: string, collectionId: string) =>
      apiClient.del<{ success: boolean }>(`/api/bookmarks/${bookmarkId}/collections/${collectionId}`),
  },

  bookmarks: {
    list: (params: { collectionId?: string; tagId?: string; domain?: string }) => {
      const qs = new URLSearchParams();
      if (params.collectionId) qs.set("collectionIds", params.collectionId);
      if (params.tagId) qs.set("tagId", params.tagId);
      if (params.domain) qs.set("domain", params.domain);
      return apiClient.get<Bookmark[]>(`/api/bookmarks?${qs}`);
    },
    get: (id: string) =>
      apiClient.get<Bookmark>(`/api/bookmarks/${id}`),
    create: (url: string, collectionIds?: string[]) =>
      apiClient.post<CreateBookmarkResult>("/api/bookmarks", { url, collectionIds }),
    refresh: (id: string) =>
      apiClient.post<{ success: boolean }>(`/api/bookmarks/${id}/refresh`, {}),
    delete: (id: string) =>
      apiClient.del<{ success: boolean }>(`/api/bookmarks/${id}`),
    bulkDelete: (ids: string[]) =>
      apiClient.post<{ success: boolean }>("/api/bookmarks/bulk-delete", { ids }),
  },

  spaces: {
    list: () => apiClient.get<Space[]>("/api/spaces"),
  },

  tags: {
    list: () => apiClient.get<Tag[]>("/api/tags"),
  },

  domains: {
    list: () => apiClient.get<Domain[]>("/api/domains"),
  },

  readability: (bookmarkId: string) =>
    apiClient.get<{ title: string | null; content: string; byline: string }>(`/api/bookmarks/${bookmarkId}/readability`),
};

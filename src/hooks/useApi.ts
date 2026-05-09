import { useState, useCallback } from "react";
import { Bookmark, Space, Collection, Tag, Domain } from "../types";

interface ToastMessage {
  message: string;
  type: "success" | "error" | "info";
}

export function useApi(setToast: (toast: ToastMessage | null) => void) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  const fetchSpaces = useCallback(async () => {
    try {
      const res = await fetch("/api/spaces");
      const data = await res.json();
      setSpaces(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch spaces", e);
      setSpaces([]);
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/collections");
      const data = await res.json();
      setCollections(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch collections", e);
      setCollections([]);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const data = await res.json();
      setTags(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch tags", e);
      setTags([]);
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      setDomains(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch domains", e);
      setDomains([]);
    }
  }, []);

  const fetchAllMetadata = useCallback(async () => {
    await Promise.all([
      fetchSpaces(),
      fetchCollections(),
      fetchTags(),
      fetchDomains(),
    ]);
  }, [fetchSpaces, fetchCollections, fetchTags, fetchDomains]);

  const fetchBookmarks = useCallback(async (
    selectedCollectionId: string | null,
    selectedTagId: string | null,
    selectedDomain: string | null,
  ): Promise<Bookmark[]> => {
    let url = "/api/bookmarks?";
    if (selectedCollectionId) url += `collectionIds=${encodeURIComponent(selectedCollectionId)}&`;
    if (selectedTagId) url += `tagId=${encodeURIComponent(selectedTagId)}&`;
    if (selectedDomain) url += `domain=${encodeURIComponent(selectedDomain)}&`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Failed to fetch bookmarks", e);
      return [];
    }
  }, []);

  const initialize = useCallback(async () => {
    try {
      await Promise.all([
        fetchSpaces(),
        fetchCollections(),
        fetchTags(),
        fetchDomains(),
      ]);
    } catch (error) {
      console.error("Failed to initialize app:", error);
      setToast({ message: "Failed to load data. Please reload.", type: "error" });
    } finally {
      setIsInitializing(false);
    }
  }, [fetchSpaces, fetchCollections, fetchTags, fetchDomains, setToast]);

  return {
    spaces,
    collections,
    setCollections,
    tags,
    domains,
    isInitializing,
    setIsInitializing,
    fetchSpaces,
    fetchCollections,
    fetchTags,
    fetchDomains,
    fetchAllMetadata,
    fetchBookmarks,
    initialize,
  };
}

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

  const fetchJson = useCallback(async <T,>(url: string, setter: (data: T[]) => void) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setter(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(`Failed to fetch ${url}`, e);
      setter([]);
    }
  }, []);

  const fetchSpaces = useCallback(async () => fetchJson("/api/spaces", setSpaces), [fetchJson]);
  const fetchCollections = useCallback(async () => fetchJson("/api/collections", setCollections), [fetchJson]);
  const fetchTags = useCallback(async () => fetchJson("/api/tags", setTags), [fetchJson]);
  const fetchDomains = useCallback(async () => fetchJson("/api/domains", setDomains), [fetchJson]);

  const fetchAllMetadata = useCallback(async () => {
    await Promise.all([
      fetchSpaces(),
      fetchCollections(),
      fetchTags(),
      fetchDomains(),
    ]);
  }, [fetchSpaces, fetchCollections, fetchTags, fetchDomains]);

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
    initialize,
  };
}

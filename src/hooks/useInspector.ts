const MIN_INSPECTOR_WIDTH = 250;
const MAX_INSPECTOR_WIDTH_OFFSET = 350;
const DEFAULT_INSPECTOR_WIDTH = 400;

import { useState, useEffect, useCallback } from "react";
import { Bookmark } from "../types";
import { getYouTubeId } from "../utils";

export function useInspector() {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    const saved = localStorage.getItem("inspectorWidth");
    return saved ? parseInt(saved, 10) : DEFAULT_INSPECTOR_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);

  const [inspectorTab, setInspectorTab] = useState<"details" | "reader" | "web" | "video">("details");
  const [webPreviewMode, setWebPreviewMode] = useState<"proxy" | "direct">("proxy");
  const [webPreviewKey, setWebPreviewKey] = useState(0);
  const [readerContent, setReaderContent] = useState<{
    title: string | null;
    content: string;
    byline: string;
  } | null>(null);
  const [isReaderLoading, setIsReaderLoading] = useState(false);
  const [refreshingBookmarkIds, setRefreshingBookmarkIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= MIN_INSPECTOR_WIDTH && newWidth <= window.innerWidth - MAX_INSPECTOR_WIDTH_OFFSET) {
        setInspectorWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem("inspectorWidth", inspectorWidth.toString());
    }
  }, [isDragging, inspectorWidth]);

  const loadReaderView = useCallback(async (bookmark: Bookmark) => {
    setIsReaderLoading(true);
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}/readability`);
      const data = await res.json();
      if (data && data.content) {
        setReaderContent(data);
      } else {
        setReaderContent({
          title: bookmark.title,
          content: "<p>Could not extract readable content.</p>",
          byline: "",
        });
      }
    } catch (error) {
      console.error(error);
      setReaderContent({
        title: bookmark.title,
        content: "<p>Error loading reader view.</p>",
        byline: "",
      });
    } finally {
      setIsReaderLoading(false);
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  return {
    isInspectorOpen,
    setIsInspectorOpen,
    inspectorWidth,
    setInspectorWidth,
    isDragging,
    setIsDragging,
    inspectorTab,
    setInspectorTab,
    webPreviewMode,
    setWebPreviewMode,
    webPreviewKey,
    setWebPreviewKey,
    readerContent,
    setReaderContent,
    isReaderLoading,
    setIsReaderLoading,
    refreshingBookmarkIds,
    setRefreshingBookmarkIds,
    loadReaderView,
    handleMouseDown,
    getYouTubeId,
  };
}

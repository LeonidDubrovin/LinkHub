import React, { useState, useEffect } from "react";

export function useUI() {
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    return (localStorage.getItem('viewMode') as "list" | "grid") || "list";
  });
  const [itemSize, setItemSize] = useState<"small" | "medium" | "large">(() => {
    return (localStorage.getItem('itemSize') as "small" | "medium" | "large") || "medium";
  });
  const [pinnedDomains, setPinnedDomains] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pinnedDomains') || '[]');
    } catch {
      return [];
    }
  });
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "title_asc" | "title_desc" | "domain_asc" | "domain_desc">("date_desc");
  const [filterBy, setFilterBy] = useState<"all" | "has_images" | "has_summary" | "has_content">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('itemSize', itemSize);
  }, [itemSize]);

  useEffect(() => {
    localStorage.setItem('pinnedDomains', JSON.stringify(pinnedDomains));
  }, [pinnedDomains]);

  const togglePinDomain = (domain: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedDomains(prev =>
      prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]
    );
  };

  return {
    viewMode,
    setViewMode,
    itemSize,
    setItemSize,
    pinnedDomains,
    setPinnedDomains,
    sortBy,
    setSortBy,
    filterBy,
    setFilterBy,
    searchQuery,
    setSearchQuery,
    togglePinDomain,
  };
}

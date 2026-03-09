import React, { useState, useRef } from "react";
import { Bookmark } from "../types";
import { cn } from "../lib/utils";

export function DynamicCover({ bookmark, viewMode, faviconUrl }: { bookmark: Bookmark, viewMode: string, faviconUrl: string }) {
  const [hoverIndex, setHoverIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  let images: string[] = [];
  try {
    if (bookmark.images_json) {
      images = JSON.parse(bookmark.images_json);
    }
  } catch (e) {}

  if (images.length === 0 && bookmark.cover_image_url) {
    images = [bookmark.cover_image_url];
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (images.length <= 1 || !containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const sectionWidth = width / images.length;
    const index = Math.min(Math.floor(x / sectionWidth), images.length - 1);
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(0);
  };

  if (images.length > 0) {
    return (
      <div 
        ref={containerRef}
        className="w-full h-full relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={images[hoverIndex]}
          alt=""
          className="w-full h-full object-cover transition-opacity duration-200"
          referrerPolicy="no-referrer"
        />
        {images.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-0.5 px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {images.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex-1 h-full rounded-full transition-colors",
                  i === hoverIndex ? "bg-white" : "bg-white/40"
                )} 
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback to screenshot API if no images found
  return (
    <img 
      src={`https://image.thum.io/get/width/600/crop/800/${bookmark.url}`} 
      alt="Screenshot" 
      className="w-full h-full object-cover" 
      referrerPolicy="no-referrer" 
      onError={(e) => {
        // If screenshot fails, fallback to favicon
        (e.target as HTMLImageElement).src = faviconUrl;
        (e.target as HTMLImageElement).className = viewMode === 'list' ? "w-6 h-6 opacity-50" : "w-16 h-16 opacity-20";
      }}
    />
  );
}

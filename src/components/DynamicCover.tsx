import React, { useState, useRef, useEffect } from "react";
import { Bookmark } from "../types";
import { cn } from "../lib/utils";

export function DynamicCover({ bookmark, viewMode, faviconUrl }: { bookmark: Bookmark, viewMode: string, faviconUrl: string }) {
  const [hoverIndex, setHoverIndex] = useState(0);
  const [validImages, setValidImages] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let images: string[] = [];
    try {
      if (bookmark.images_json) {
        images = JSON.parse(bookmark.images_json);
      }
    } catch (e) {}

    if (images.length === 0 && bookmark.cover_image_url) {
      images = [bookmark.cover_image_url];
    }

    if (images.length <= 1) {
      setValidImages(images);
      return;
    }

    let isMounted = true;
    
    // Always keep the first image (usually cover_image_url or og:image)
    const valid = [images[0]];
    setValidImages(valid);

    const checkImages = async () => {
      const promises = images.slice(1).map(async (src) => {
        try {
          const img = new Image();
          img.referrerPolicy = "no-referrer";
          
          const loadPromise = new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
          });
          
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
          
          img.src = src;
          await Promise.race([loadPromise, timeoutPromise]);
          
          if (img.naturalWidth >= 100 && img.naturalHeight >= 100) {
            return src;
          }
        } catch (e) {}
        return null;
      });
      
      const results = await Promise.all(promises);
      const validResults = results.filter(Boolean) as string[];
      
      if (isMounted && validResults.length > 0) {
        setValidImages([...valid, ...validResults]);
      }
    };
    
    checkImages();
    
    return () => {
      isMounted = false;
    };
  }, [bookmark.images_json, bookmark.cover_image_url]);

  const imagesToUse = validImages.length > 0 ? validImages : (bookmark.cover_image_url ? [bookmark.cover_image_url] : []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (imagesToUse.length <= 1 || !containerRef.current) return;
    const { left, width } = containerRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const sectionWidth = width / imagesToUse.length;
    const index = Math.min(Math.floor(x / sectionWidth), imagesToUse.length - 1);
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(0);
  };

  if (imagesToUse.length > 0) {
    return (
      <div 
        ref={containerRef}
        className="w-full h-full relative group"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={imagesToUse[hoverIndex] || imagesToUse[0]}
          alt=""
          className="w-full h-full object-cover transition-opacity duration-200"
          referrerPolicy="no-referrer"
        />
        {imagesToUse.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 flex gap-0.5 px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {imagesToUse.map((_, i) => (
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
        const target = e.target as HTMLImageElement;
        if (target.src !== faviconUrl) {
          target.src = faviconUrl;
          target.className = viewMode === 'list' ? "w-6 h-6 opacity-50" : "w-16 h-16 opacity-20";
        }
      }}
    />
  );
}

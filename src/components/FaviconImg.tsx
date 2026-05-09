import { Globe } from "lucide-react";

export function FaviconImg({ domain, size = 16, className = "rounded-sm" }: { domain: string; size?: number; className?: string }) {
  return (
    <img
      src={`/api/favicons/${domain}`}
      alt=""
      width={size}
      height={size}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
        const parent = target.parentElement;
        if (parent && !parent.querySelector("svg")) {
          const span = document.createElement("span");
          span.style.display = "inline-flex";
          span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
          parent.appendChild(span);
        }
      }}
    />
  );
}

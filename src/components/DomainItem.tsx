import React from "react";
import { Pin, PinOff } from "lucide-react";
import { cn } from "../lib/utils";
import { FaviconImg } from "./FaviconImg";

interface DomainItemProps {
  domain: string;
  count: number;
  isSelected: boolean;
  isPinned: boolean;
  onSelect: (domain: string) => void;
  onTogglePin: (domain: string, e: React.MouseEvent) => void;
}

export function DomainItem({
  domain,
  count,
  isSelected,
  isPinned,
  onSelect,
  onTogglePin,
}: DomainItemProps) {
  return (
    <button
      onClick={() => onSelect(domain)}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-1.5 pr-3 rounded-md text-sm mb-0.5 group select-none",
        isSelected
          ? "bg-blue-100 text-blue-700 font-medium"
          : "hover:bg-slate-200 text-slate-700",
      )}
    >
      <FaviconImg domain={domain} />
      <span className="truncate flex-1 text-left">{domain}</span>
      <span className="text-xs text-slate-400 font-medium group-hover:hidden">
        {count}
      </span>
      <div
        className="hidden group-hover:flex items-center justify-center text-slate-400 hover:text-slate-600"
        onClick={(e) => onTogglePin(domain, e)}
        title={isPinned ? "Unpin resource" : "Pin resource"}
      >
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </div>
    </button>
  );
}

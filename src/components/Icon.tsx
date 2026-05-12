import React from 'react';
import * as LucideIcons from 'lucide-react';
import { FaviconImg } from './FaviconImg';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number;
  color?: string;
}

function isEmoji(str: string): boolean {
  // Quick check: if the string contains any emoji-range character
  const emojiRegex = /\p{Emoji_Presentation}/u;
  return emojiRegex.test(str);
}

export const Icon = ({ name, size = 24, color = 'currentColor', ...props }: IconProps) => {
  // Parse prefix: lucide:Folder, emoji:🚀, favicon:github.com
  let type = 'lucide';
  let value = name;

  if (name.startsWith('lucide:')) {
    type = 'lucide';
    value = name.slice(7);
  } else if (name.startsWith('emoji:')) {
    type = 'emoji';
    value = name.slice(6);
  } else if (name.startsWith('favicon:')) {
    type = 'favicon';
    value = name.slice(8);
  } else if (isEmoji(name)) {
    // Bare emoji without prefix
    type = 'emoji';
    value = name;
  }

  if (type === 'emoji') {
    return (
      <span
        style={{
          fontSize: size,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
        }}
        {...(props as any)}
      >
        {value}
      </span>
    );
  }

  if (type === 'favicon') {
    return <FaviconImg domain={value} size={size} className="rounded-sm" />;
  }

  // Lucide icon
  const LucideIcon = (LucideIcons as any)[value];
  if (!LucideIcon) {
    const FallbackIcon = (LucideIcons as any)['CircleHelp'] || (LucideIcons as any)['HelpCircle'];
    if (!FallbackIcon) return null;
    return <FallbackIcon size={size} color={color} {...props} />;
  }
  return <LucideIcon size={size} color={color} {...props} />;
};

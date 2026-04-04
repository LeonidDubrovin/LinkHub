import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number;
  color?: string;
}

export const Icon = ({ name, size = 24, color = 'currentColor', ...props }: IconProps) => {
  const LucideIcon = (LucideIcons as Record<string, React.ComponentType<any>>)[name];
  if (!LucideIcon) {
    const FallbackIcon = (LucideIcons as Record<string, React.ComponentType<any>>)['CircleHelp'] || (LucideIcons as Record<string, React.ComponentType<any>>)['HelpCircle'];
    if (!FallbackIcon) return null;
    return <FallbackIcon size={size} color={color} {...props} />;
  }
  return <LucideIcon size={size} color={color} {...props} />;
};

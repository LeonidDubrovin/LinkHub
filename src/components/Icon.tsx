import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number;
  color?: string;
}

export const Icon = ({ name, size = 24, color = 'currentColor', ...props }: IconProps) => {
  const LucideIcon = (LucideIcons as any)[name];
  if (!LucideIcon) {
    return <LucideIcons.HelpCircle size={size} color={color} {...props} />;
  }
  return <LucideIcon size={size} color={color} {...props} />;
};

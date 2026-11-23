'use client';

import React, { FC, ReactNode } from "react";
import {
  Heart,
  Sun,
  Compass,
  Flower2,
  Sparkles,
  BookOpen,
  Scroll,
  HandHeart,
  Landmark,
  Calendar,
  Volume2,
  Video,
  Tag,
  HelpCircle,
} from "lucide-react";
import { getCategoryInfo } from "@/data/taxonomy";

export interface CategoryIconProps {
  categoryName?: string;
  iconName?: string;
  iconUrl?: string; // Icon do admin đặt cho chuyên mục (ảnh thư viện, đường dẫn, hoặc SVG dạng data:) — xem lib/category-icons.ts
  iconNode?: ReactNode;
  className?: string;
}

// Icon dictionary lookup map for Lucide iconName string
const LUCIDE_ICON_MAP: Record<string, FC<{ className?: string }>> = {
  Heart,
  Sun,
  Compass,
  Flower2,
  Sparkles,
  BookOpen,
  Scroll,
  HandHeart,
  Landmark,
  Calendar,
  Volume2,
  Video,
  Tag,
  HelpCircle,
};

/** "flower-2" (the name the admin's icon library uses) → "Flower2" (the key of LUCIDE_ICON_MAP). */
const pascal = (name: string) => name.replace(/(^|-)([a-z0-9])/g, (_m, _dash, ch: string) => ch.toUpperCase());

/**
 * Flexible Category/Taxonomy Icon component.
 * Priority rendering:
 * 1. iconUrl: the icon the admin set for the category (picture or data: SVG) -> renders <img loading="lazy" decoding="async" src={iconUrl} />
 * 2. iconNode: If custom ReactNode provided -> renders iconNode
 * 3. iconName: If Lucide iconName string provided -> renders matched Lucide icon
 * 4. categoryName: If categoryName provided -> queries taxonomy mapping getCategoryInfo
 */
export function getCategory1Icon(
  categoryName?: string,
  iconUrl?: string,
  iconNode?: ReactNode,
  className: string = "w-3.5 h-3.5 text-[#F2C14E] shrink-0",
  iconName?: string
): ReactNode {
  // 1. WordPress CMS Custom Icon URL (SVG/PNG)
  if (iconUrl) {
    return (
      <img loading="lazy" decoding="async"
        src={iconUrl}
        alt={categoryName || "category icon"}
        className={`object-contain shrink-0 ${className}`}
      />
    );
  }

  // 2. Direct ReactNode Icon
  if (iconNode) {
    return iconNode;
  }

  // 3. Lucide Icon Name String
  const lucideKey = iconName ? (LUCIDE_ICON_MAP[iconName] ? iconName : pascal(iconName)) : '';
  if (lucideKey && LUCIDE_ICON_MAP[lucideKey]) {
    const DynamicIcon = LUCIDE_ICON_MAP[lucideKey];
    return <DynamicIcon className={className} />;
  }

  // 4. Taxonomy Name Lookup Fallback
  const { IconComponent, iconUrl: taxUrl } = getCategoryInfo(categoryName);
  if (taxUrl) {
    return (
      <img loading="lazy" decoding="async"
        src={taxUrl}
        alt={categoryName || "category icon"}
        className={`object-contain shrink-0 ${className}`}
      />
    );
  }

  return <IconComponent className={className} />;
}

export const CategoryIcon: FC<CategoryIconProps> = ({
  categoryName,
  iconName,
  iconUrl,
  iconNode,
  className = "w-3.5 h-3.5 text-[#F2C14E] shrink-0",
}) => {
  return (
    <>
      {getCategory1Icon(categoryName, iconUrl, iconNode, className, iconName)}
    </>
  );
};

export default CategoryIcon;

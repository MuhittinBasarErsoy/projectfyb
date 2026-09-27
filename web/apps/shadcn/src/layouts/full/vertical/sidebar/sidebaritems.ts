import type { LucideIcon } from "lucide-react";
import { NAV } from "@fyblue/core";
import { NAV_ICONS } from "@/components/fyblue/shell";

export interface ChildItem {
  id?: number | string;
  name: string;
  icon?: LucideIcon;
  items?: ChildItem[];
  item?: unknown;
  url?: string;
  color?: string;
  disabled?: boolean;
  subtitle?: string;
  badge?: boolean;
  badgeType?: string;
  badgeContent?: string;
  isActive?: boolean;
  external?: boolean;
  isPro?: boolean
}

export interface MenuItem {
  heading?: string;
  name?: string;
  icon?: LucideIcon;
  id?: number;
  to?: string;
  item?: MenuItem[];
  items?: ChildItem[];
  url?: string;
  disabled?: boolean;
  subtitle?: string;
  badgeType?: string;
  badge?: boolean;
  badgeContent?: string;
  isActive?: boolean;
  isPro?: boolean
}

// FyBlue menüsü (ortak NAV tanımından): OSOS, EPİAŞ ve Ayarlar grupları.
const SidebarContent: MenuItem[] = NAV.map((group) => ({
  heading: group.title,
  items: group.items.map((item) => ({
    id: item.path,
    name: item.title,
    icon: NAV_ICONS[item.icon],
    url: item.path,
  })),
}));

export default SidebarContent;

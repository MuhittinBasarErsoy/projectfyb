import type { Icons } from '@/components/icons';

export interface NavItem {
  title: string;
  url: string;
  icon?: keyof typeof Icons;
  shortcut?: [string, string];
  isActive?: boolean;
  /** Yalnızca tam eşleşmede etkin (alt sayfaları olan menüler için). */
  exact?: boolean;
  items?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

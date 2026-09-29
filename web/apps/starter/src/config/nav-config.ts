import { NAV, type NavIcon } from '@fyblue/core';
import type { Icons } from '@/components/icons';
import type { NavGroup } from '@/types';

/**
 * FyBlue menüsü (ortak NAV tanımından). Hem kenar menüde hem Cmd+K paletinde kullanılır.
 */
const ICON: Record<NavIcon, keyof typeof Icons> = {
  home: 'dashboard',
  search: 'search',
  history: 'history',
  clock: 'clock',
  weather: 'weather',
  gauge: 'gauge',
  layers: 'layers',
  function: 'formula',
  link: 'plug',
  user: 'profile',
  building: 'teams',
  sliders: 'settings'
};

// Cmd+K kısayolları (iki harf art arda)
const SHORTCUT: Record<string, [string, string]> = {
  '/': ['g', 'g'],
  '/osos/query': ['s', 's'],
  '/osos/history': ['h', 'h'],
  '/epias/endpoints': ['e', 'e'],
  '/epias/formulas': ['f', 'f']
};

export const navGroups: NavGroup[] = NAV.map((group) => ({
  label: group.title,
  items: group.items.map((item) => ({
    title: item.title,
    url: item.path,
    icon: ICON[item.icon],
    exact: item.exact,
    shortcut: SHORTCUT[item.path],
    items: []
  }))
}));

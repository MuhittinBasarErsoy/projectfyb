'use client';

import { breadcrumbs } from '@fyblue/core';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

/** Konum yolu (ör. EPİAŞ / Servisler / Detay) — ortak menü tanımından. */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();
  return useMemo(
    () => [{ title: 'FyBlue', link: '/' }, ...breadcrumbs(pathname).map((c) => ({ title: c.title, link: c.path ?? '' }))],
    [pathname]
  );
}

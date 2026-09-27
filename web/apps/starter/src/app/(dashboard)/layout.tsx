'use client';

import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { rememberTemplate, useAuth } from '@fyblue/core';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Yan menü açık/kapalı durumu tarayıcıda saklanır (şablon bunu çerezle yapıyor). */
function readSidebarCookie() {
  if (typeof document === 'undefined') return true;
  const m = /(?:^|;\s*)sidebar_state=([^;]+)/.exec(document.cookie);
  return m ? m[1] === 'true' : true;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Statik HTML oturumsuz üretilir; oturum tarayıcıda (localStorage) okunduktan sonra çizilir.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Bu şablon açıldıysa kullanıcı onu seçmiştir; kök adres (/) bir dahaki sefere buraya yönlenir.
    rememberTemplate('starter');
  }, []);

  // Oturum yoksa giriş ekranına (dönüş adresiyle) yönlendir.
  useEffect(() => {
    if (!mounted || isAuthenticated) return;
    const back = pathname + window.location.search;
    router.replace(back && back !== '/' ? `/signin/?returnUrl=${encodeURIComponent(back)}` : '/signin/');
  }, [mounted, isAuthenticated, pathname, router]);

  if (!mounted || !isAuthenticated) return null;

  return (
    <KBar>
      <SidebarProvider defaultOpen={readSidebarCookie()}>
        <a
          href='#main-content'
          className='bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2'
        >
          İçeriğe geç
        </a>
        <AppSidebar />
        <SidebarInset id='main-content' tabIndex={-1} className='scroll-mt-16'>
          <Header />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}

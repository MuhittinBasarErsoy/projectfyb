import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/components/themes/font.config';
import { DEFAULT_THEME } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import '../styles/globals.css';

const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
};

export const metadata: Metadata = {
  title: {
    default: 'FyBlue',
    template: '%s · FyBlue'
  },
  description: 'OSOS sayaç verileri ve EPİAŞ Şeffaflık Platformu tek hesapla, tek panelde.',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light
};

// Statik yayın: renk teması (data-theme) ve açık/koyu mod ilk boyamadan önce tarayıcıda uygulanır.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='tr' suppressHydrationWarning data-theme={DEFAULT_THEME}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var m = document.cookie.match(/(?:^|;\s*)active_theme=([^;]+)/);
                if (m) document.documentElement.setAttribute('data-theme', decodeURIComponent(m[1]));
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body
        className={cn(
          'bg-background overflow-x-hidden overscroll-none font-sans antialiased',
          fontVariables
        )}
      >
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <Providers>
            <Toaster />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { NextConfig } from 'next';

// Sunucu (FyBlue.Server) bu şablonu /starter/ altında statik dosya olarak yayınlar:
// Node.js sunucusu gerekmez. Oturum ve veriler doğrudan /api uçlarından okunur.
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/starter',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['geist', '@fyblue/core'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  // Geliştirmede API isteklerini çalışan FyBlue.Server'a yönlendir (statik çıktıda kullanılmaz).
  ...(isDev
    ? {
        async rewrites() {
          return [
            { source: '/api/:path*', destination: 'http://localhost:5151/api/:path*', basePath: false as const }
          ];
        }
      }
    : {})
};

export default nextConfig;

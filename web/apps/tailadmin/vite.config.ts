import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

// Sunucu bu şablonu /tailadmin/ altında yayınlar; derleme çıktısı doğrudan
// FyBlue.Server/wwwroot/tailadmin klasörüne yazılır.
export default defineConfig({
  base: "/tailadmin/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:5151", "/hangfire": "http://localhost:5151" },
  },
  build: {
    outDir: "../../../src/FyBlue.Server/wwwroot/tailadmin",
    emptyOutDir: true,
  },
});

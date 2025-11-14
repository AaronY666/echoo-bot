import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@services": path.resolve(__dirname, "./src/services"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: ["electron", "electron/main", "electron/renderer"],
    },
  },
  server: {
    port: 5173,
  },
  publicDir: "public",
});


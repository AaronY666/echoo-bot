import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@services": path.resolve(__dirname, "./src/services"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
  },
  publicDir: "public",
});


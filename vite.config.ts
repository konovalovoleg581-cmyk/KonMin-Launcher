import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Конфиг для Tauri: фиксированный порт, без очистки экрана, сборка в dist/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2021",
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },
});

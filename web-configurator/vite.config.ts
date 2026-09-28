import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the single-file build also works when GitHub Pages
  // serves it from a project subpath (/Esphome-Max7219-Matrix-Clock/)
  // instead of a custom domain root.
  base: "./",
  // The dev server is only used while editing locally (and by the Arena
  // preview), so any Host header is accepted there. The production build in
  // dist/ is static files and has no server at all.
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});

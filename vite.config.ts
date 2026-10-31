import { defineConfig } from "vite";
export default defineConfig({ base: "./", build: { rollupOptions: { input: { index: "index.html", check: "check.html", grid: "grid.html" } } } });

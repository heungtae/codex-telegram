import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/assets/",
  publicDir: "static",
  build: {
    outDir: "../static/dist",
    emptyOutDir: true,
  },
});

import { defineConfig } from "vite";

export default defineConfig({
  base: "/wheel-of-fortune/",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
});

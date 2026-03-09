import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["electron/main.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist-electron",
  clean: true,
});

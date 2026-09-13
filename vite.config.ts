import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import babel from "@rolldown/plugin-babel";
import "dotenv/config";
import { normalizeBasePath } from "./app/utils/appUrl.ts";

export default defineConfig({
  base: `${normalizeBasePath(process.env.TI4_BASE_PATH)}/`,
  plugins: [
    babel({
      presets: ["@babel/preset-typescript"],
      plugins: ["babel-plugin-react-compiler"],
    }),
    reactRouter(),
  ],
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    include: ["react-loading-indicators"],
  },
  server: {
    warmup: {
      clientFiles: [
        "./app/root.tsx",
        "./app/routes/draft.prechoice/**/*.tsx",
        "./app/routes/draft.new/**/*.tsx",
        "./app/routes/draft.$id/**/*.tsx",
      ],
      ssrFiles: [
        "./app/routes/draft.new/route.tsx",
        "./app/routes/draft.$id._index/route.tsx",
      ],
    },
  },
});

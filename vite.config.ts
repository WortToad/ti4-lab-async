import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import babel from "vite-plugin-babel";
import "dotenv/config";
import { normalizeBasePath } from "./app/utils/appUrl";

export default defineConfig({
  base: `${normalizeBasePath(process.env.TI4_BASE_PATH)}/`,
  plugins: [
    babel({
      filter: /\.[jt]sx?$/,
      babelConfig: {
        presets: ["@babel/preset-typescript"],
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
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
        "./server.ts",
        "./app/routes/draft.new/route.tsx",
        "./app/routes/draft.$id._index/route.tsx",
      ],
    },
  },
});

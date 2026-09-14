import type { Config } from "@react-router/dev/config";
import "dotenv/config";
import { normalizeBasePath } from "./app/utils/appUrl";

export default {
  ssr: true,
  buildDirectory: process.env.TI4_BUILD_DIRECTORY || "build",
  basename: normalizeBasePath(process.env.TI4_BASE_PATH) || "/",
} satisfies Config;

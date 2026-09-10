import type { Config } from "@react-router/dev/config";
import "dotenv/config";
import { normalizeBasePath } from "./app/utils/appUrl";

export default {
  ssr: true,
  basename: normalizeBasePath(process.env.TI4_BASE_PATH) || "/",
} satisfies Config;

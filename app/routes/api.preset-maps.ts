import { ActionFunctionArgs, data } from "react-router";
import { createPresetMap } from "~/drizzle/presetMap.server";
import { mapConfigs } from "~/mapgen/mapConfigs";
import {
  decodeMapString,
  encodeMapString,
} from "~/mapgen/utils/mapStringCodec";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data(
      { success: false, error: "Method not allowed" },
      { status: 405 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return data(
      { success: false, error: "Provide a JSON object with the map details" },
      { status: 400 },
    );
  }
  const field = (key: string) => {
    const value = (body as Record<string, unknown>)[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const name = field("name");
  const description = field("description");
  const author = field("author");
  const mapString = field("mapString");
  const mapConfigId = field("mapConfigId");

  if (!name || !description || !author || !mapString || !mapConfigId) {
    return data(
      { success: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (!Object.hasOwn(mapConfigs, mapConfigId)) {
    return data(
      { success: false, error: "Choose a supported map layout" },
      { status: 400 },
    );
  }
  const decoded = decodeMapString(mapString);
  // The editor decoder repairs incomplete or unknown input. Publication must
  // preserve the submitted map exactly instead of silently storing those repairs.
  if (
    !decoded ||
    decoded.map.some((tile) => tile.type === "OPEN") ||
    encodeMapString(decoded.map) !==
      mapString
        .split(",")
        .map((tile) => tile.trim())
        .join(",")
  ) {
    return data(
      {
        success: false,
        error: "The map string contains invalid tiles or positions",
      },
      { status: 400 },
    );
  }

  const preset = await createPresetMap({
    name,
    description,
    author,
    mapString,
    mapConfigId,
  });

  return data({ success: true, id: preset.id, slug: preset.slug });
}

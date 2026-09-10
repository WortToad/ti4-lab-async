import { LoaderFunctionArgs, redirect } from "react-router";
import {
  presetMapById,
  updatePresetMapImageUrl,
} from "~/drizzle/presetMap.server";
import { decodeMapString } from "~/mapgen/utils/mapStringCodec";
import { generateMapGeneratorImageBuffer } from "~/skiaRendering/mapGeneratorImage.server";
import { syncPresetMapImageToR2 } from "~/utils/syncImageToR2.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const id = params.id;
  if (!id) {
    throw new Response("Map ID required", { status: 400 });
  }

  const preset = await presetMapById(id);
  if (!preset) {
    throw new Response("Preset map not found", { status: 404 });
  }

  if (preset.imageUrl) {
    return redirect(preset.imageUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const decoded = decodeMapString(preset.mapString);
  if (!decoded) {
    throw new Response("Invalid map string format", { status: 400 });
  }

  const imageBuffer = await generateMapGeneratorImageBuffer(decoded.map);
  if (process.env.R2_INTEGRATION_DISABLED === "true") {
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
  const cdnUrl = await syncPresetMapImageToR2(preset.id, imageBuffer);
  await updatePresetMapImageUrl(preset.id, cdnUrl);

  return redirect(cdnUrl, {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

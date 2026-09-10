import { appUrl } from "~/utils/appUrl";
import {
  initializeFonts,
  loadAllAssets,
} from "./cache.server";
import {
  calculateCanvasDimensions,
  drawBackground,
  drawBranding,
  drawMap,
  createCanvas,
} from "./canvasUtils.server";
import { Map } from "~/types";

/**
 * Generate a map image buffer from a decoded map
 */
export async function generateMapGeneratorImageBuffer(
  map: Map,
): Promise<Buffer> {
  // Initialize fonts and load all assets
  initializeFonts();
  await loadAllAssets();

  // Calculate canvas dimensions based on map size
  const dimensions = calculateCanvasDimensions(map);
  const { canvas, ctx } = createCanvas(dimensions.width, dimensions.height);

  // Draw all layers
  drawBackground(ctx, dimensions.width, dimensions.height);
  drawMap(ctx, map, [], dimensions);
  drawBranding(ctx, dimensions.width, dimensions.height, {
    urlText: appUrl("/map-generator").replace(/^https?:\/\//, ""),
  });

  // Return PNG buffer
  return await canvas.toBuffer("png");
}

export async function generateMapPreviewImageBuffer(
  map: Map,
  options: { scale?: number; withBranding?: boolean; urlText?: string } = {},
): Promise<Buffer> {
  initializeFonts();
  await loadAllAssets();

  const baseDimensions = calculateCanvasDimensions(map);
  const scale = options.scale ?? 0.6;
  const dimensions = {
    ...baseDimensions,
    width: Math.round(baseDimensions.width * scale),
    height: Math.round(baseDimensions.height * scale),
    radius: baseDimensions.radius * scale,
    gap: baseDimensions.gap * scale,
    hOffset: baseDimensions.hOffset * scale,
    wOffset: baseDimensions.wOffset * scale,
  };

  const { canvas, ctx } = createCanvas(dimensions.width, dimensions.height);

  drawBackground(ctx, dimensions.width, dimensions.height);
  drawMap(ctx, map, [], dimensions);

  if (options.withBranding) {
    drawBranding(ctx, dimensions.width, dimensions.height, {
      urlText: options.urlText,
    });
  }

  return await canvas.toBuffer("png");
}

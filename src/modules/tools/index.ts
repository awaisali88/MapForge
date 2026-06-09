import { drawPolygonTool } from "./draw-polygon";
import { measureDistanceTool } from "./measure-distance";

export type { Tool, ToolContext, ToolId, ToolSetupResult } from "./types";

export { drawPolygonTool, measureDistanceTool };

/**
 * Built-in tools, in the order they appear in the toolbar / command palette.
 * Downstream forks can extend by spreading this array and adding their own.
 */
export const TOOLS: readonly [typeof measureDistanceTool, typeof drawPolygonTool] = [
  measureDistanceTool,
  drawPolygonTool,
];

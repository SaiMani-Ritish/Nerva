/**
 * Tools module exports
 */

import { FilesystemTool } from "./fs";
import { WebTool } from "./web";
import { ProcessTool } from "./process";
import { loadConfig } from "../config";
import type { Tool } from "./types";

export { FilesystemTool } from "./fs";
export { WebTool } from "./web";
export { ProcessTool } from "./process";
export { ToolRegistryImpl } from "./registry";
export type * from "./types";

/**
 * Initialize all tools with configuration
 */
export async function createTools(): Promise<Tool[]> {
  const config = await loadConfig();

  return [
    new FilesystemTool(config.filesystem),
    new WebTool(config.network),
    new ProcessTool(config.commands),
  ];
}

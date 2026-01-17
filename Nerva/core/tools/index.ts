/**
 * Tools module exports
 */

import { FilesystemTool } from "./fs.js";
import { WebTool } from "./web.js";
import { ProcessTool } from "./process.js";
import { loadConfig } from "../config/index.js";
import type { Tool } from "./types.js";

export { FilesystemTool } from "./fs.js";
export { WebTool } from "./web.js";
export { ProcessTool } from "./process.js";
export { ToolRegistryImpl } from "./registry.js";
export type * from "./types.js";

/**
 * Initialize all tools with configuration
 */
export async function createTools(): Promise<Tool[]> {
  const config = await loadConfig();

  return [
    new FilesystemTool(config.policies.filesystem as any),
    new WebTool(config.policies.network as any),
    new ProcessTool(config.policies.commands as any),
  ];
}

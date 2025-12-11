/**
 * Legacy configuration loader
 * @deprecated Use core/config/index.ts instead
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// Re-export new config types for backwards compatibility
export type { PoliciesConfig as PolicyConfigNew, NervaConfig } from "./config/types";
export { loadConfig as loadFullConfig, ConfigLoader } from "./config/loader";
export { createLogger, LogLevel } from "./config/logger";

/**
 * Legacy PolicyConfig interface (for backwards compatibility)
 */
export interface PolicyConfig {
  filesystem: {
    allow_roots: string[];
    deny_patterns: string[];
    deny_paths: string[];
    max_file_size: number;
  };
  network: {
    allowed_hosts: string[];
    blocked_hosts: string[];
    rate_limit: {
      requests: number;
      window_seconds: number;
    };
    timeout_seconds: number;
    max_response_size: number;
  };
  commands: {
    whitelist: string[];
    blacklist: string[];
    timeout_seconds: number;
    max_output_size: number;
  };
}

/**
 * Load legacy policy configuration
 * @deprecated Use loadConfig from core/config instead
 */
export async function loadConfig(): Promise<PolicyConfig> {
  const configPath = path.resolve(process.cwd(), "config/policies.yaml");

  try {
    const content = await fs.readFile(configPath, "utf-8");
    const raw = yaml.load(content) as Record<string, unknown>;

    // Parse and return in legacy format
    const fs_policy = raw.filesystem as Record<string, unknown> || {};
    const net_policy = raw.network as Record<string, unknown> || {};
    const cmd_policy = raw.commands as Record<string, unknown> || {};
    const rate_limit = net_policy.rate_limit as Record<string, number> || {};

    return {
      filesystem: {
        allow_roots: (fs_policy.allow_roots as string[]) || ["./workspace"],
        deny_patterns: (fs_policy.deny_patterns as string[]) || [],
        deny_paths: (fs_policy.deny_paths as string[]) || [],
        max_file_size: Number(fs_policy.max_file_size) || 10485760,
      },
      network: {
        allowed_hosts: (net_policy.allowed_hosts as string[]) || [],
        blocked_hosts: (net_policy.blocked_hosts as string[]) || [],
        rate_limit: {
          requests: Number(rate_limit.requests) || 10,
          window_seconds: Number(rate_limit.window_seconds) || 60,
        },
        timeout_seconds: Number(net_policy.timeout_seconds) || 30,
        max_response_size: Number(net_policy.max_response_size) || 10485760,
      },
      commands: {
        whitelist: (cmd_policy.whitelist as string[]) || [],
        blacklist: (cmd_policy.blacklist as string[]) || [],
        timeout_seconds: Number(cmd_policy.timeout_seconds) || 30,
        max_output_size: Number(cmd_policy.max_output_size) || 1048576,
      },
    };
  } catch (error) {
    console.warn(
      `Failed to load policies from ${configPath}, using defaults. Error: ${(error as Error).message}`
    );
    return {
      filesystem: {
        allow_roots: ["./workspace"],
        deny_patterns: [],
        deny_paths: [],
        max_file_size: 1024 * 1024,
      },
      network: {
        allowed_hosts: [],
        blocked_hosts: [],
        rate_limit: { requests: 10, window_seconds: 60 },
        timeout_seconds: 30,
        max_response_size: 1024 * 1024 * 10,
      },
      commands: {
        whitelist: [],
        blacklist: [],
        timeout_seconds: 10,
        max_output_size: 1024 * 1024,
      },
    };
  }
}

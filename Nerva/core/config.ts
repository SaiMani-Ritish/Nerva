import { promises as fs } from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

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

export async function loadConfig(): Promise<PolicyConfig> {
  // Try to find config relative to CWD
  // In dev: Nerva/config/policies.yaml
  // In prod: dist/../config/policies.yaml (needs care)
  
  // For MVP, assume running from project root
  const configPath = path.resolve(process.cwd(), "config/policies.yaml");
  
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return yaml.load(content) as PolicyConfig;
  } catch (error) {
    console.warn(`Failed to load policies from ${configPath}, using defaults. Error: ${(error as Error).message}`);
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


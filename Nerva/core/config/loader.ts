/**
 * Configuration loader with validation and environment variable support
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import type {
  NervaConfig,
  ModelsConfig,
  ToolsConfig,
  PoliciesConfig,
  ConfigValidationError,
  EnvVarMapping,
} from "./types.js";
import { getDefaults } from "./defaults.js";

/**
 * Environment variable mappings
 */
const ENV_MAPPINGS: EnvVarMapping[] = [
  // Model settings
  { path: "models.default.local", envVar: "NERVA_DEFAULT_LOCAL_MODEL", type: "string" },
  { path: "models.default.cloud", envVar: "NERVA_DEFAULT_CLOUD_MODEL", type: "string" },
  { path: "models.fallback.enabled", envVar: "NERVA_FALLBACK_ENABLED", type: "boolean" },
  { path: "models.fallback.timeoutMs", envVar: "NERVA_FALLBACK_TIMEOUT_MS", type: "number" },

  // API keys (from environment only, never in config files)
  { path: "secrets.openaiApiKey", envVar: "OPENAI_API_KEY", type: "string" },
  { path: "secrets.anthropicApiKey", envVar: "ANTHROPIC_API_KEY", type: "string" },

  // Network settings
  { path: "policies.network.timeoutSeconds", envVar: "NERVA_NETWORK_TIMEOUT", type: "number" },
  { path: "policies.network.maxResponseSize", envVar: "NERVA_MAX_RESPONSE_SIZE", type: "number" },

  // Command settings
  { path: "policies.commands.timeoutSeconds", envVar: "NERVA_COMMAND_TIMEOUT", type: "number" },

  // LLM settings
  { path: "policies.llm.maxTokensPerRequest", envVar: "NERVA_MAX_TOKENS", type: "number" },
  { path: "policies.llm.maxCostPerRequest", envVar: "NERVA_MAX_COST_PER_REQUEST", type: "number" },

  // Logging
  { path: "policies.audit.logToolCalls", envVar: "NERVA_LOG_TOOL_CALLS", type: "boolean" },
  { path: "policies.audit.logLlmCalls", envVar: "NERVA_LOG_LLM_CALLS", type: "boolean" },
];

/**
 * Configuration loader
 */
export class ConfigLoader {
  private configDir: string;
  private config: NervaConfig | null = null;
  private errors: ConfigValidationError[] = [];

  constructor(configDir?: string) {
    this.configDir = configDir || path.resolve(process.cwd(), "config");
  }

  /**
   * Load all configuration files
   */
  async load(): Promise<NervaConfig> {
    this.errors = [];

    // Start with defaults
    const config = getDefaults();

    // Load each config file
    const models = await this.loadYaml<Record<string, unknown>>("models.yaml");
    const tools = await this.loadYaml<Record<string, unknown>>("tools.yaml");
    const policies = await this.loadYaml<Record<string, unknown>>("policies.yaml");

    // Merge with defaults
    if (models) {
      config.models = this.parseModelsConfig(models);
    }
    if (tools) {
      config.tools = this.parseToolsConfig(tools);
    }
    if (policies) {
      config.policies = this.parsePoliciesConfig(policies);
    }

    // Apply environment variable overrides
    this.applyEnvOverrides(config);

    // Validate
    this.validate(config);

    if (this.errors.length > 0) {
      console.warn("Configuration warnings:");
      for (const error of this.errors) {
        console.warn(`  - ${error.path}: ${error.message}`);
      }
    }

    this.config = config;
    return config;
  }

  /**
   * Get cached config or load
   */
  async getConfig(): Promise<NervaConfig> {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  /**
   * Reload configuration
   */
  async reload(): Promise<NervaConfig> {
    this.config = null;
    return this.load();
  }

  /**
   * Get validation errors
   */
  getErrors(): ConfigValidationError[] {
    return [...this.errors];
  }

  /**
   * Load a YAML file
   */
  private async loadYaml<T>(filename: string): Promise<T | null> {
    const filePath = path.join(this.configDir, filename);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return yaml.load(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.errors.push({
          path: filename,
          message: `Config file not found: ${filePath}`,
        });
      } else {
        this.errors.push({
          path: filename,
          message: `Failed to parse: ${(error as Error).message}`,
        });
      }
      return null;
    }
  }

  /**
   * Parse models configuration
   */
  private parseModelsConfig(raw: Record<string, unknown>): ModelsConfig {
    const defaults = getDefaults().models;
    const models = raw.models as Array<Record<string, unknown>> || [];
    const defaultModels = raw.default as Record<string, string> || {};
    const fallback = raw.fallback as Record<string, unknown> || {};

    return {
      models: models.map((m) => ({
        name: String(m.name || "unknown"),
        type: (m.type as "local" | "cloud") || "local",
        provider: String(m.provider || ""),
        modelPath: m.model_path as string | undefined,
        modelId: m.model_id as string | undefined,
        contextSize: Number(m.context_size || 4096),
        gpuLayers: m.gpu_layers as number | undefined,
        costPerToken: m.cost_per_token as number | undefined,
        enabled: m.enabled !== false,
      })),
      default: {
        local: defaultModels.local || defaults.default.local,
        cloud: defaultModels.cloud || defaults.default.cloud,
      },
      fallback: {
        enabled: fallback.enabled !== false,
        timeoutMs: Number(fallback.timeout_ms || defaults.fallback.timeoutMs),
        qualityThreshold: Number(fallback.quality_threshold || defaults.fallback.qualityThreshold),
      },
    };
  }

  /**
   * Parse tools configuration
   */
  private parseToolsConfig(raw: Record<string, unknown>): ToolsConfig {
    const tools = raw.tools as Record<string, Record<string, unknown>> || {};

    const result: ToolsConfig = { tools: {} };

    for (const [name, config] of Object.entries(tools)) {
      result.tools[name] = {
        enabled: config.enabled !== false,
        description: String(config.description || ""),
        searchProvider: config.search_provider as string | undefined,
        userAgent: config.user_agent as string | undefined,
      };
    }

    return result;
  }

  /**
   * Parse policies configuration
   */
  private parsePoliciesConfig(raw: Record<string, unknown>): PoliciesConfig {
    const defaults = getDefaults().policies;
    const fs = raw.filesystem as Record<string, unknown> || {};
    const net = raw.network as Record<string, unknown> || {};
    const cmd = raw.commands as Record<string, unknown> || {};
    const llm = raw.llm as Record<string, unknown> || {};
    const audit = raw.audit as Record<string, unknown> || {};
    const rateLimit = net.rate_limit as Record<string, number> || {};

    return {
      filesystem: {
        allowRoots: (fs.allow_roots as string[]) || defaults.filesystem.allowRoots,
        denyPatterns: (fs.deny_patterns as string[]) || defaults.filesystem.denyPatterns,
        denyPaths: (fs.deny_paths as string[]) || defaults.filesystem.denyPaths,
        maxFileSize: Number(fs.max_file_size || defaults.filesystem.maxFileSize),
        maxReadFiles: Number(fs.max_read_files || defaults.filesystem.maxReadFiles),
      },
      network: {
        allowedHosts: (net.allowed_hosts as string[]) || defaults.network.allowedHosts,
        blockedHosts: (net.blocked_hosts as string[]) || defaults.network.blockedHosts,
        rateLimit: {
          requests: Number(rateLimit.requests || defaults.network.rateLimit.requests),
          windowSeconds: Number(rateLimit.window_seconds || defaults.network.rateLimit.windowSeconds),
        },
        timeoutSeconds: Number(net.timeout_seconds || defaults.network.timeoutSeconds),
        maxResponseSize: Number(net.max_response_size || defaults.network.maxResponseSize),
      },
      commands: {
        whitelist: (cmd.whitelist as string[]) || defaults.commands.whitelist,
        blacklist: (cmd.blacklist as string[]) || defaults.commands.blacklist,
        timeoutSeconds: Number(cmd.timeout_seconds || defaults.commands.timeoutSeconds),
        maxOutputSize: Number(cmd.max_output_size || defaults.commands.maxOutputSize),
        maxConcurrent: Number(cmd.max_concurrent || defaults.commands.maxConcurrent),
      },
      llm: {
        maxTokensPerRequest: Number(llm.max_tokens_per_request || defaults.llm.maxTokensPerRequest),
        maxCostPerRequest: Number(llm.max_cost_per_request || defaults.llm.maxCostPerRequest),
        maxCostPerHour: Number(llm.max_cost_per_hour || defaults.llm.maxCostPerHour),
        maxRequestsPerMinute: Number(llm.max_requests_per_minute || defaults.llm.maxRequestsPerMinute),
        enableContentFilter: llm.enable_content_filter === true,
        blockedTopics: (llm.blocked_topics as string[]) || defaults.llm.blockedTopics,
      },
      audit: {
        logToolCalls: audit.log_tool_calls !== false,
        logLlmCalls: audit.log_llm_calls !== false,
        redactSecrets: audit.redact_secrets !== false,
        secretPatterns: (audit.secret_patterns as string[]) || defaults.audit.secretPatterns,
        retentionDays: Number(audit.retention_days || defaults.audit.retentionDays),
      },
    };
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvOverrides(config: NervaConfig): void {
    for (const mapping of ENV_MAPPINGS) {
      const envValue = process.env[mapping.envVar];
      if (envValue === undefined) continue;

      try {
        const value = this.parseEnvValue(envValue, mapping.type);
        this.setNestedValue(config, mapping.path, value);
      } catch (error) {
        this.errors.push({
          path: mapping.envVar,
          message: `Invalid value for ${mapping.envVar}: ${(error as Error).message}`,
          value: envValue,
        });
      }
    }
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(
    value: string,
    type: "string" | "number" | "boolean" | "string[]"
  ): unknown {
    switch (type) {
      case "string":
        return value;
      case "number":
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error("Not a valid number");
        }
        return num;
      case "boolean":
        return value.toLowerCase() === "true" || value === "1";
      case "string[]":
        return value.split(",").map((s) => s.trim());
      default:
        return value;
    }
  }

  /**
   * Set a nested value in an object
   */
  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const parts = path.split(".");
    let current = obj as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Validate configuration
   */
  private validate(config: NervaConfig): void {
    // Validate models
    if (config.models.models.length === 0) {
      this.errors.push({
        path: "models.models",
        message: "No models configured",
      });
    }

    // Validate default models exist
    const modelNames = new Set(config.models.models.map((m) => m.name));
    if (config.models.default.local && !modelNames.has(config.models.default.local)) {
      this.errors.push({
        path: "models.default.local",
        message: `Default local model "${config.models.default.local}" not found`,
        value: config.models.default.local,
      });
    }
    if (config.models.default.cloud && !modelNames.has(config.models.default.cloud)) {
      this.errors.push({
        path: "models.default.cloud",
        message: `Default cloud model "${config.models.default.cloud}" not found`,
        value: config.models.default.cloud,
      });
    }

    // Validate filesystem roots
    if (config.policies.filesystem.allowRoots.length === 0) {
      this.errors.push({
        path: "policies.filesystem.allowRoots",
        message: "No allowed filesystem roots configured",
      });
    }

    // Validate rate limits
    if (config.policies.network.rateLimit.requests <= 0) {
      this.errors.push({
        path: "policies.network.rateLimit.requests",
        message: "Rate limit must be positive",
        value: config.policies.network.rateLimit.requests,
      });
    }

    // Validate LLM limits
    if (config.policies.llm.maxTokensPerRequest <= 0) {
      this.errors.push({
        path: "policies.llm.maxTokensPerRequest",
        message: "Max tokens must be positive",
        value: config.policies.llm.maxTokensPerRequest,
      });
    }
  }
}

/**
 * Create a config loader instance
 */
export function createConfigLoader(configDir?: string): ConfigLoader {
  return new ConfigLoader(configDir);
}

/**
 * Load configuration (convenience function)
 */
export async function loadConfig(configDir?: string): Promise<NervaConfig> {
  const loader = new ConfigLoader(configDir);
  return loader.load();
}


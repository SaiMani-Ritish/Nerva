/**
 * Default configuration values
 */

import type { NervaConfig } from "./types";

/**
 * Get default configuration
 */
export function getDefaults(): NervaConfig {
  return {
    models: {
      models: [
        {
          name: "gpt-4",
          type: "cloud",
          provider: "openai",
          modelId: "gpt-4-turbo-preview",
          contextSize: 128000,
          costPerToken: 0.00003,
          enabled: true,
        },
      ],
      default: {
        local: "llama-3-8b",
        cloud: "gpt-4",
      },
      fallback: {
        enabled: true,
        timeoutMs: 5000,
        qualityThreshold: 0.8,
      },
    },

    tools: {
      tools: {
        fs: {
          enabled: true,
          description: "Filesystem operations",
        },
        web: {
          enabled: true,
          description: "HTTP requests and web search",
          searchProvider: "duckduckgo",
          userAgent: "Nerva/0.1.0",
        },
        process: {
          enabled: true,
          description: "Execute system commands",
        },
      },
    },

    policies: {
      filesystem: {
        allowRoots: ["./workspace", "./scratch"],
        denyPatterns: [".*", "**/node_modules/**", "**/.git/**"],
        denyPaths: ["/etc", "/usr", "/System", "/Windows"],
        maxFileSize: 10 * 1024 * 1024, // 10 MB
        maxReadFiles: 100,
      },

      network: {
        allowedHosts: ["*"],
        blockedHosts: ["localhost", "127.0.0.1", "0.0.0.0"],
        rateLimit: {
          requests: 10,
          windowSeconds: 60,
        },
        timeoutSeconds: 30,
        maxResponseSize: 10 * 1024 * 1024, // 10 MB
      },

      commands: {
        whitelist: ["git", "npm", "pnpm", "node", "python", "python3", "cat", "ls", "grep"],
        blacklist: ["rm", "sudo", "su", "chmod", "chown", "dd"],
        timeoutSeconds: 30,
        maxOutputSize: 1024 * 1024, // 1 MB
        maxConcurrent: 5,
      },

      llm: {
        maxTokensPerRequest: 4096,
        maxCostPerRequest: 1.0,
        maxCostPerHour: 10.0,
        maxRequestsPerMinute: 60,
        enableContentFilter: false,
        blockedTopics: [],
      },

      audit: {
        logToolCalls: true,
        logLlmCalls: true,
        redactSecrets: true,
        secretPatterns: ["api[_-]?key", "password", "token", "secret"],
        retentionDays: 30,
      },
    },
  };
}

/**
 * Merge user config with defaults (deep merge)
 */
export function mergeWithDefaults(
  userConfig: Partial<NervaConfig>
): NervaConfig {
  const defaults = getDefaults();

  return {
    models: {
      ...defaults.models,
      ...userConfig.models,
      default: {
        ...defaults.models.default,
        ...userConfig.models?.default,
      },
      fallback: {
        ...defaults.models.fallback,
        ...userConfig.models?.fallback,
      },
    },
    tools: {
      tools: {
        ...defaults.tools.tools,
        ...userConfig.tools?.tools,
      },
    },
    policies: {
      filesystem: {
        ...defaults.policies.filesystem,
        ...userConfig.policies?.filesystem,
      },
      network: {
        ...defaults.policies.network,
        ...userConfig.policies?.network,
        rateLimit: {
          ...defaults.policies.network.rateLimit,
          ...userConfig.policies?.network?.rateLimit,
        },
      },
      commands: {
        ...defaults.policies.commands,
        ...userConfig.policies?.commands,
      },
      llm: {
        ...defaults.policies.llm,
        ...userConfig.policies?.llm,
      },
      audit: {
        ...defaults.policies.audit,
        ...userConfig.policies?.audit,
      },
    },
  };
}


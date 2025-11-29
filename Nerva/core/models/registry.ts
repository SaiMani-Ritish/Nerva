/**
 * Model Registry - loads and manages model adapters from config
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import type { ModelAdapter } from "./types";
import { OpenAIAdapter } from "./openai-adapter";
import { LocalAdapter } from "./local-adapter";
import { FallbackAdapter } from "./fallback-adapter";

export interface ModelDefinition {
  name: string;
  type: "local" | "cloud";
  provider: string;
  model_path?: string;
  model_id?: string;
  context_size?: number;
  gpu_layers?: number;
  cost_per_token?: number;
  enabled: boolean;
}

export interface ModelsConfig {
  models: ModelDefinition[];
  default: {
    local: string;
    cloud: string;
  };
  fallback: {
    enabled: boolean;
    timeout_ms: number;
    quality_threshold: number;
  };
}

export class ModelRegistry {
  private adapters: Map<string, ModelAdapter> = new Map();
  private config: ModelsConfig | null = null;

  /**
   * Load models from config file
   */
  async loadFromConfig(configPath?: string): Promise<void> {
    const resolvedPath = configPath || path.resolve(process.cwd(), "config/models.yaml");

    try {
      const content = await fs.readFile(resolvedPath, "utf-8");
      this.config = yaml.load(content) as ModelsConfig;

      // Initialize enabled models
      for (const model of this.config.models) {
        if (model.enabled) {
          await this.initializeModel(model);
        }
      }
    } catch (error) {
      console.warn(`Failed to load models config: ${(error as Error).message}`);
      // Use defaults
      this.config = {
        models: [],
        default: { local: "", cloud: "" },
        fallback: { enabled: false, timeout_ms: 5000, quality_threshold: 0.8 },
      };
    }
  }

  /**
   * Initialize a model adapter
   */
  private async initializeModel(model: ModelDefinition): Promise<void> {
    let adapter: ModelAdapter;

    switch (model.type) {
      case "local":
        adapter = new LocalAdapter({
          modelPath: model.model_path || "",
          contextSize: model.context_size,
          gpuLayers: model.gpu_layers,
        });
        break;

      case "cloud":
        if (model.provider === "openai") {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            console.warn(`Skipping ${model.name}: OPENAI_API_KEY not set`);
            return;
          }
          adapter = new OpenAIAdapter({
            apiKey,
            model: model.model_id || model.name,
          });
        } else if (model.provider === "anthropic") {
          // TODO: Implement Anthropic adapter
          console.warn(`Anthropic adapter not yet implemented, skipping ${model.name}`);
          return;
        } else {
          console.warn(`Unknown provider ${model.provider}, skipping ${model.name}`);
          return;
        }
        break;

      default:
        console.warn(`Unknown model type ${model.type}, skipping ${model.name}`);
        return;
    }

    this.adapters.set(model.name, adapter);
  }

  /**
   * Get a specific model adapter by name
   */
  get(name: string): ModelAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get the default model adapter
   */
  getDefault(): ModelAdapter | undefined {
    if (!this.config) return undefined;

    // If fallback is enabled, create a fallback adapter
    if (this.config.fallback.enabled) {
      const localAdapter = this.adapters.get(this.config.default.local);
      const cloudAdapter = this.adapters.get(this.config.default.cloud);

      if (localAdapter && cloudAdapter) {
        return new FallbackAdapter(
          localAdapter,
          cloudAdapter,
          this.config.fallback.timeout_ms
        );
      }
    }

    // Otherwise, prefer cloud
    return (
      this.adapters.get(this.config.default.cloud) ||
      this.adapters.get(this.config.default.local) ||
      this.adapters.values().next().value
    );
  }

  /**
   * List all available model names
   */
  listModels(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Register a custom adapter
   */
  register(name: string, adapter: ModelAdapter): void {
    this.adapters.set(name, adapter);
  }
}

// Singleton instance
let registryInstance: ModelRegistry | null = null;

export async function getModelRegistry(): Promise<ModelRegistry> {
  if (!registryInstance) {
    registryInstance = new ModelRegistry();
    await registryInstance.loadFromConfig();
  }
  return registryInstance;
}


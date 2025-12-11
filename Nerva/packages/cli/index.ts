/**
 * Nerva CLI - Command Line Interface
 */

import { loadFullConfig, createLogger, LogLevel, type NervaConfig } from "../../core/config";
import { NervaShell } from "../../apps/shell";
import { Kernel } from "../../core/kernel/kernel";
import { ToolRegistryImpl } from "../../core/tools/registry";
import { createTools } from "../../core/tools";
import { MemoryManager } from "../../core/memory";
import { LocalAdapter } from "../../core/models/local-adapter";
import { OpenAIAdapter } from "../../core/models/openai-adapter";
import { FallbackAdapter } from "../../core/models/fallback-adapter";
import type { ModelAdapter } from "../../core/models/types";

const logger = createLogger("cli");

/**
 * CLI command handlers
 */
const commands: Record<string, (args: string[]) => Promise<void>> = {
  run: runCommand,
  help: helpCommand,
  version: versionCommand,
  config: configCommand,
  "model": modelCommand,
};

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; args: string[] } {
  const args = process.argv.slice(2);
  const command = args[0] || "run";
  return { command, args: args.slice(1) };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { command, args } = parseArgs();

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "nerva help" for available commands');
    process.exit(1);
  }

  try {
    await handler(args);
  } catch (error) {
    logger.error("Command failed", { error: (error as Error).message });
    console.error(`\nError: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Run the Nerva shell
 */
async function runCommand(args: string[]): Promise<void> {
  logger.info("Starting Nerva...");

  // Parse run options
  const options = {
    configDir: getArgValue(args, "--config", "-c"),
    logLevel: getArgValue(args, "--log-level", "-l"),
    noColor: hasFlag(args, "--no-color"),
  };

  // Set log level
  if (options.logLevel) {
    const level = LogLevel[options.logLevel.toUpperCase() as keyof typeof LogLevel];
    if (level !== undefined) {
      logger.setLevel(level);
    }
  }

  // Load configuration
  logger.info("Loading configuration...");
  const config = await loadFullConfig(options.configDir);

  // Create model adapter
  logger.info("Initializing model adapter...");
  const modelAdapter = await createModelAdapter(config);

  // Create tool registry
  logger.info("Loading tools...");
  const toolRegistry = new ToolRegistryImpl();
  const tools = await createTools();
  for (const tool of tools) {
    if (config.tools.tools[tool.name]?.enabled !== false) {
      toolRegistry.register(tool);
    }
  }

  // Create memory manager
  const memoryManager = new MemoryManager({
    tokenBudget: config.policies.llm.maxTokensPerRequest,
    vectorStoreEnabled: true,
    summaryThreshold: 0.8,
    loggerBasePath: "./scratch/transcripts",
  });

  // Create kernel
  logger.info("Initializing kernel...");
  const kernel = new Kernel(
    {
      modelAdapter: config.models.default.local || config.models.default.cloud,
      toolsEnabled: Object.keys(config.tools.tools).filter(
        (t) => config.tools.tools[t].enabled
      ),
      agentsEnabled: ["planner", "executor", "summarizer"],
      memoryConfig: {
        tokenBudget: config.policies.llm.maxTokensPerRequest,
        vectorStoreEnabled: true,
      },
    },
    {
      modelAdapter,
      toolRegistry,
      memoryManager,
    }
  );

  // Create and start shell
  logger.info("Starting shell...");
  const shell = new NervaShell(kernel);
  await shell.start();

  logger.info("Nerva stopped");
}

/**
 * Create model adapter based on configuration
 */
async function createModelAdapter(config: NervaConfig): Promise<ModelAdapter> {
  const localModel = config.models.models.find(
    (m) => m.name === config.models.default.local && m.enabled
  );
  const cloudModel = config.models.models.find(
    (m) => m.name === config.models.default.cloud && m.enabled
  );

  // Check for API keys
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Create adapters based on what's available
  let localAdapter: ModelAdapter | undefined;
  let cloudAdapter: ModelAdapter | undefined;

  if (localModel && localModel.modelPath) {
    localAdapter = new LocalAdapter({
      modelPath: localModel.modelPath,
      contextSize: localModel.contextSize,
      gpuLayers: localModel.gpuLayers,
    });
    logger.info(`Local model: ${localModel.name}`);
  }

  if (cloudModel && cloudModel.provider === "openai" && openaiKey) {
    cloudAdapter = new OpenAIAdapter({
      apiKey: openaiKey,
      model: cloudModel.modelId || cloudModel.name,
    });
    logger.info(`Cloud model: ${cloudModel.name}`);
  }

  // Use fallback if both are available
  if (localAdapter && cloudAdapter && config.models.fallback.enabled) {
    logger.info("Using fallback adapter");
    return new FallbackAdapter(
      localAdapter,
      cloudAdapter,
      config.models.fallback.timeoutMs
    );
  }

  // Return whichever is available
  if (localAdapter) {
    return localAdapter;
  }
  if (cloudAdapter) {
    return cloudAdapter;
  }

  // No adapters available - create a mock that will error
  logger.warn("No models available - please configure a model");
  return new LocalAdapter({
    modelPath: "",
  });
}

/**
 * Show help
 */
async function helpCommand(_args: string[]): Promise<void> {
  console.log(`
Nerva - LLM-native OS

USAGE:
  nerva <command> [options]

COMMANDS:
  run             Start the Nerva shell (default)
  help            Show this help message
  version         Show version information
  config          Show current configuration
  model pull      Download a model
  model list      List available models

RUN OPTIONS:
  -c, --config <dir>    Configuration directory (default: ./config)
  -l, --log-level       Log level: debug, info, warn, error
  --no-color            Disable color output

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY        OpenAI API key for cloud models
  ANTHROPIC_API_KEY     Anthropic API key for Claude models
  NERVA_LOG_LEVEL       Default log level
  NERVA_CONFIG_DIR      Default config directory

EXAMPLES:
  nerva                 Start shell with default config
  nerva run -l debug    Start with debug logging
  nerva config          Show current configuration
  nerva model list      List available models

For more information, visit: https://github.com/nerva-project/nerva
`);
}

/**
 * Show version
 */
async function versionCommand(_args: string[]): Promise<void> {
  console.log("Nerva v0.1.0");
  console.log(`Node.js ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
}

/**
 * Show configuration
 */
async function configCommand(args: string[]): Promise<void> {
  const configDir = getArgValue(args, "--config", "-c");
  const config = await loadFullConfig(configDir);

  console.log("\n=== Nerva Configuration ===\n");

  console.log("Models:");
  for (const model of config.models.models) {
    const status = model.enabled ? "✓" : "✗";
    console.log(`  ${status} ${model.name} (${model.type}/${model.provider})`);
  }
  console.log(`  Default local: ${config.models.default.local}`);
  console.log(`  Default cloud: ${config.models.default.cloud}`);

  console.log("\nTools:");
  for (const [name, tool] of Object.entries(config.tools.tools)) {
    const status = tool.enabled ? "✓" : "✗";
    console.log(`  ${status} ${name}: ${tool.description}`);
  }

  console.log("\nPolicies:");
  console.log(`  Filesystem roots: ${config.policies.filesystem.allowRoots.join(", ")}`);
  console.log(`  Network rate limit: ${config.policies.network.rateLimit.requests}/min`);
  console.log(`  Max tokens: ${config.policies.llm.maxTokensPerRequest}`);
  console.log(`  Max cost/request: $${config.policies.llm.maxCostPerRequest}`);

  console.log("\nEnvironment:");
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "set" : "not set"}`);
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "set" : "not set"}`);
}

/**
 * Model management command
 */
async function modelCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "list":
      await modelListCommand();
      break;
    case "pull":
      await modelPullCommand(args.slice(1));
      break;
    default:
      console.log("Usage: nerva model <list|pull> [options]");
  }
}

/**
 * List models
 */
async function modelListCommand(): Promise<void> {
  const config = await loadFullConfig();

  console.log("\n=== Available Models ===\n");

  console.log("Local Models:");
  for (const model of config.models.models.filter((m) => m.type === "local")) {
    const status = model.enabled ? "✓" : "✗";
    const isDefault = model.name === config.models.default.local ? "(default)" : "";
    console.log(`  ${status} ${model.name} ${isDefault}`);
    console.log(`      Provider: ${model.provider}`);
    console.log(`      Path: ${model.modelPath || "not set"}`);
    console.log(`      Context: ${model.contextSize} tokens`);
  }

  console.log("\nCloud Models:");
  for (const model of config.models.models.filter((m) => m.type === "cloud")) {
    const status = model.enabled ? "✓" : "✗";
    const isDefault = model.name === config.models.default.cloud ? "(default)" : "";
    console.log(`  ${status} ${model.name} ${isDefault}`);
    console.log(`      Provider: ${model.provider}`);
    console.log(`      Model ID: ${model.modelId || "not set"}`);
    console.log(`      Context: ${model.contextSize} tokens`);
    if (model.costPerToken) {
      console.log(`      Cost: $${model.costPerToken}/token`);
    }
  }
}

/**
 * Pull/download a model
 */
async function modelPullCommand(args: string[]): Promise<void> {
  const modelName = args[0];

  if (!modelName) {
    console.log("Usage: nerva model pull <model-name>");
    console.log("\nAvailable models to pull:");
    console.log("  llama-3-8b       - Llama 3 8B (Q4 quantized, ~4GB)");
    console.log("  llama-3-70b      - Llama 3 70B (Q4 quantized, ~40GB)");
    console.log("  mistral-7b       - Mistral 7B (Q4 quantized, ~4GB)");
    return;
  }

  console.log(`\nPulling model: ${modelName}...`);
  console.log("\n⚠️  Model downloading is not yet implemented.");
  console.log("Please download models manually and update config/models.yaml");
  console.log("\nRecommended sources:");
  console.log("  - Hugging Face: https://huggingface.co");
  console.log("  - Ollama: https://ollama.com");
}

/**
 * Helper: Get argument value
 */
function getArgValue(args: string[], long: string, short?: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === long || (short && args[i] === short)) {
      return args[i + 1];
    }
    if (args[i].startsWith(`${long}=`)) {
      return args[i].split("=")[1];
    }
  }
  return undefined;
}

/**
 * Helper: Check for flag
 */
function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

// Run main
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

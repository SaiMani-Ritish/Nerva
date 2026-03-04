/**
 * Configuration types for Nerva
 */

/**
 * Model configuration
 */
export interface ModelConfig {
  name: string;
  type: "local" | "cloud";
  provider: string;
  modelPath?: string;
  modelId?: string;
  contextSize: number;
  gpuLayers?: number;
  costPerToken?: number;
  enabled: boolean;
}

export interface ModelsConfig {
  models: ModelConfig[];
  default: {
    local: string;
    cloud: string;
  };
  fallback: {
    enabled: boolean;
    timeoutMs: number;
    qualityThreshold: number;
  };
}

/**
 * Tool configuration
 */
export interface ToolConfig {
  enabled: boolean;
  description: string;
  searchProvider?: string;
  userAgent?: string;
}

export interface ToolsConfig {
  tools: Record<string, ToolConfig>;
}

/**
 * Policy configuration
 */
export interface FilesystemPolicy {
  allowRoots: string[];
  denyPatterns: string[];
  denyPaths: string[];
  maxFileSize: number;
  maxReadFiles: number;
}

export interface NetworkPolicy {
  allowedHosts: string[];
  blockedHosts: string[];
  rateLimit: {
    requests: number;
    windowSeconds: number;
  };
  timeoutSeconds: number;
  maxResponseSize: number;
}

export interface CommandsPolicy {
  whitelist: string[];
  blacklist: string[];
  timeoutSeconds: number;
  maxOutputSize: number;
  maxConcurrent: number;
}

export interface LLMPolicy {
  maxTokensPerRequest: number;
  maxCostPerRequest: number;
  maxCostPerHour: number;
  maxRequestsPerMinute: number;
  enableContentFilter: boolean;
  blockedTopics: string[];
}

export interface AuditPolicy {
  logToolCalls: boolean;
  logLlmCalls: boolean;
  redactSecrets: boolean;
  secretPatterns: string[];
  retentionDays: number;
}

export interface GitPolicy {
  allowPush: boolean;
  allowForcePush: boolean;
  allowedRemotes: string[];
  maxLogCount: number;
}

export interface DockerPolicy {
  allowStart: boolean;
  allowStop: boolean;
  allowBuild: boolean;
  allowExec: boolean;
  allowRemove: boolean;
  maxLogLines: number;
}

export interface DatabasePolicy {
  allowedDatabases: string[];
  readOnly: boolean;
  allowWrite: boolean;
  maxRows: number;
  blockedOperations: string[];
  maxQueryTimeSeconds: number;
}

export interface SshPolicy {
  allowedHosts: string[];
  blockedCommands: string[];
  timeoutSeconds: number;
  allowUpload: boolean;
  allowDownload: boolean;
  maxTransferSize: number;
}

export interface EmailPolicy {
  allowSend: boolean;
  allowedRecipients: string[];
  blockedRecipients: string[];
  maxAttachmentSize: number;
  requireConfirmation: boolean;
}

export interface CalendarPolicy {
  allowCreate: boolean;
  allowDelete: boolean;
  allowUpdate: boolean;
  maxEventsFetch: number;
  defaultCalendar: string;
}

export interface ClipboardPolicy {
  allowRead: boolean;
  allowWrite: boolean;
  maxContentSize: number;
}

export interface ImagePolicy {
  model: string;
  maxImageSize: number;
  supportedFormats: string[];
}

export interface AudioPolicy {
  transcriptionModel: string;
  ttsEnabled: boolean;
  maxAudioSize: number;
  supportedFormats: string[];
}

export interface ScreenshotPolicy {
  allowCapture: boolean;
  outputDirectory: string;
  maxCapturesPerMinute: number;
}

export interface PoliciesConfig {
  filesystem: FilesystemPolicy;
  network: NetworkPolicy;
  commands: CommandsPolicy;
  git: GitPolicy;
  docker: DockerPolicy;
  database: DatabasePolicy;
  ssh: SshPolicy;
  email: EmailPolicy;
  calendar: CalendarPolicy;
  clipboard: ClipboardPolicy;
  image: ImagePolicy;
  audio: AudioPolicy;
  screenshot: ScreenshotPolicy;
  llm: LLMPolicy;
  audit: AuditPolicy;
}

/**
 * Full Nerva configuration
 */
export interface NervaConfig {
  models: ModelsConfig;
  tools: ToolsConfig;
  policies: PoliciesConfig;
}

/**
 * Environment variable mapping
 */
export interface EnvVarMapping {
  path: string;
  envVar: string;
  type: "string" | "number" | "boolean" | "string[]";
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  path: string;
  message: string;
  value?: unknown;
}


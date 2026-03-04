/**
 * Audio tool — transcription and text-to-speech
 *
 * Transcription uses the Whisper model via Ollama or the whisper CLI.
 * TTS uses platform-native speech synthesis commands.
 */

import { execFile } from "child_process";
import { promises as fs } from "fs";
import * as path from "path";
import { platform } from "os";
import type { Tool, ToolResult } from "./types.js";

export interface AudioInput {
  action: "transcribe" | "speak" | "analyze";
  path?: string;
  text?: string;
  language?: string;
  outputPath?: string;
}

export interface AudioPolicy {
  transcriptionModel: string;
  ttsEnabled: boolean;
  maxAudioSize: number;
  supportedFormats: string[];
}

export class AudioTool implements Tool {
  name = "audio";
  description = "Audio transcription (speech-to-text) and text-to-speech";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["transcribe", "speak", "analyze"],
        description: "Audio operation to perform",
      },
      path: { type: "string", description: "Path to audio file" },
      text: { type: "string", description: "Text to convert to speech" },
      language: { type: "string", description: "Language (default: en)" },
      outputPath: { type: "string", description: "Output file path for TTS" },
    },
    required: ["action"],
  };

  constructor(private policy: AudioPolicy) {}

  async execute(input: unknown): Promise<ToolResult> {
    const startTime = Date.now();
    const ai = input as AudioInput;

    try {
      if (!ai.action) throw new Error("Missing required parameter: action");

      let output: unknown;

      switch (ai.action) {
        case "transcribe":
          if (!ai.path) throw new Error("Missing required parameter: path");
          output = await this.transcribe(ai.path, ai.language || "en");
          break;
        case "speak":
          if (!ai.text) throw new Error("Missing required parameter: text");
          if (!this.policy.ttsEnabled) throw new Error("Text-to-speech is disabled by policy");
          output = await this.speak(ai.text, ai.outputPath);
          break;
        case "analyze":
          if (!ai.path) throw new Error("Missing required parameter: path");
          output = await this.analyzeAudio(ai.path);
          break;
        default:
          throw new Error(`Unknown audio action: ${ai.action}`);
      }

      return { success: true, output, metadata: { duration_ms: Date.now() - startTime } };
    } catch (error) {
      return {
        success: false,
        error: { code: "AUDIO_ERROR", message: (error as Error).message, recoverable: true },
        metadata: { duration_ms: Date.now() - startTime },
      };
    }
  }

  private async transcribe(audioPath: string, language: string): Promise<string> {
    const ext = path.extname(audioPath).toLowerCase().replace(".", "");
    if (!this.policy.supportedFormats.includes(ext)) {
      throw new Error(`Unsupported audio format: .${ext}. Supported: ${this.policy.supportedFormats.join(", ")}`);
    }

    const stat = await fs.stat(audioPath).catch(() => {
      throw new Error(`File not found: ${audioPath}`);
    });
    if (stat.size > this.policy.maxAudioSize) {
      throw new Error(`Audio file too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max: ${(this.policy.maxAudioSize / 1024 / 1024).toFixed(1)}MB`);
    }

    return this.transcribeWithWhisper(audioPath, language);
  }

  private transcribeWithWhisper(audioPath: string, language: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "whisper",
        [audioPath, "--language", language, "--output_format", "txt", "--output_dir", path.dirname(audioPath)],
        { timeout: 120_000, maxBuffer: 5 * 1024 * 1024 },
        async (err, stdout, stderr) => {
          if (err) {
            if (err.message.includes("ENOENT") || err.message.includes("not found")) {
              reject(new Error(
                "Whisper CLI not found. Install OpenAI Whisper:\n" +
                "  pip install openai-whisper\n\n" +
                "Or use Ollama with a whisper-compatible model."
              ));
              return;
            }
            reject(new Error(stderr.trim() || err.message));
            return;
          }
          const txtPath = audioPath.replace(path.extname(audioPath), ".txt");
          try {
            const text = await fs.readFile(txtPath, "utf-8");
            resolve(text.trim());
          } catch {
            resolve(stdout.trim() || "Transcription completed but output file not found.");
          }
        }
      );
    });
  }

  private async speak(text: string, outputPath?: string): Promise<string> {
    const os = platform();

    if (os === "darwin") {
      return this.macSpeak(text, outputPath);
    } else if (os === "win32") {
      return this.windowsSpeak(text, outputPath);
    } else {
      return this.linuxSpeak(text, outputPath);
    }
  }

  private macSpeak(text: string, outputPath?: string): Promise<string> {
    const args = outputPath ? ["-o", outputPath, text] : [text];
    return new Promise((resolve, reject) => {
      execFile("say", args, { timeout: 30_000 }, (err) => {
        if (err) { reject(new Error(err.message)); return; }
        resolve(outputPath ? `Speech saved to ${outputPath}` : "Speech played");
      });
    });
  }

  private windowsSpeak(text: string, _outputPath?: string): Promise<string> {
    const psScript = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${text.replace(/'/g, "''")}')`;
    return new Promise((resolve, reject) => {
      execFile("powershell", ["-NoProfile", "-Command", psScript], { timeout: 30_000 }, (err) => {
        if (err) { reject(new Error(err.message)); return; }
        resolve("Speech played");
      });
    });
  }

  private linuxSpeak(text: string, outputPath?: string): Promise<string> {
    const args = outputPath ? ["-w", outputPath, text] : [text];
    return new Promise((resolve, reject) => {
      execFile("espeak", args, { timeout: 30_000 }, (err) => {
        if (err) {
          if (err.message.includes("ENOENT")) {
            reject(new Error("espeak not found. Install: sudo apt install espeak"));
            return;
          }
          reject(new Error(err.message));
          return;
        }
        resolve(outputPath ? `Speech saved to ${outputPath}` : "Speech played");
      });
    });
  }

  private analyzeAudio(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        "ffprobe",
        ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", audioPath],
        { timeout: 10_000 },
        (err, stdout, stderr) => {
          if (err) {
            if (err.message.includes("ENOENT")) {
              reject(new Error("ffprobe not found. Install ffmpeg:\n  macOS: brew install ffmpeg\n  Ubuntu: sudo apt install ffmpeg\n  Windows: choco install ffmpeg"));
              return;
            }
            reject(new Error(stderr.trim() || err.message));
            return;
          }
          try {
            const info = JSON.parse(stdout);
            const format = info.format || {};
            const stream = info.streams?.[0] || {};
            resolve(
              `Audio Analysis: ${path.basename(audioPath)}\n` +
              `  Format: ${format.format_long_name || format.format_name || "unknown"}\n` +
              `  Duration: ${parseFloat(format.duration || "0").toFixed(1)}s\n` +
              `  Size: ${(parseInt(format.size || "0") / 1024).toFixed(1)}KB\n` +
              `  Bitrate: ${(parseInt(format.bit_rate || "0") / 1000).toFixed(0)}kbps\n` +
              `  Sample Rate: ${stream.sample_rate || "unknown"}Hz\n` +
              `  Channels: ${stream.channels || "unknown"}\n` +
              `  Codec: ${stream.codec_name || "unknown"}`
            );
          } catch {
            resolve(stdout.trim());
          }
        }
      );
    });
  }
}

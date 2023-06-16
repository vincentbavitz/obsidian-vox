import { FSWatcher, createReadStream } from "fs";
import { readFile } from "fs/promises";
import { Plugin } from "obsidian";

type ExtendedFsWatcher = {
  resolvedPath: string;
  watcher: FSWatcher;
};

type ObsidianGitPlugin = Plugin & {
  gitManager: {
    git: unknown;
  };
};

declare module "obsidian" {
  interface App {
    dom: {
      appContainerEl: HTMLElement;
    };
    plugins: {
      enabledPlugins: Set<string>;
      plugins: {
        "obsidian-git": ObsidianGitPlugin | undefined;
      };
    };
  }

  interface Vault {
    getConfig: (key: string) => string;
    exists: (path: string) => Promise<boolean>;
  }

  interface DataAdapter {
    basePath: string;
    fs: {
      createReadStream: typeof createReadStream;
    };
    fsPromises: {
      readFile: typeof readFile;
    };
    watchers: Record<string, ExtendedFsWatcher>;
  }
}

export type TranscriptionSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type TranscriptionResponse = {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
};

export type FileDetail = {
  /** The filename without the extension */
  name: string;
  filename: string;
  extension: string;
  directory: string;
  filepath: string;
};

export type MarkdownOutput = {
  title: string;
  content: string;
};

export type VoiceMemoCategorization = {
  importance: 1 | 2 | 3 | 4 | 5;
  category: { key: string; label: string; display: string } | null;
};

export enum AudioOutputExtension {
  "MP3" = "mp3",
  "WAV" = "wav",
}

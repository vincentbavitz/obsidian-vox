import { FSWatcher, createReadStream } from "fs";
import { readFile } from "fs/promises";
import VoxPlugin from "main";

export type VoxStatusItem = {
  hash: string;
  details: FileDetail;
  status: "queued" | "converting" | "transcribing" | "complete" | "failed";
};

/**
 * Status of all transcription candidates for this session, indexed by hash.
 */
export type VoxStatusMap = Record<string, VoxStatusItem>;

type ExtendedFsWatcher = {
  resolvedPath: string;
  watcher: FSWatcher;
};

declare module "obsidian" {
  interface App {
    appId: string;
    dom: {
      appContainerEl: HTMLElement;
    };
    plugins: {
      enabledPlugins: Set<string>;
      plugins: {
        vox: VoxPlugin;
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

export type RawTranscriptionSegment = [
  number, // id
  number, // seek
  number, // start
  number, // end
  string, // text
  number[], // tokens
  number, // temperature
  number, // avg_logprob
  number, // compression_ratio
  number // no_speech_prob
];

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
  segments: RawTranscriptionSegment[];
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

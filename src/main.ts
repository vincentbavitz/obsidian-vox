import { FSWatcher } from "chokidar";
import { Plugin } from "obsidian";
import PQueue from "p-queue";
import path from "path";
import { DEFAULT_SETTINGS, Settings, VoxSettingTab } from "settings";
import { log } from "utils/various";
import { TranscriptionProcessor } from "./TranscriptionProcessor";

type FilesListener = (action: string, filename: string) => Promise<void>;

const WATCHER_DELAY_MS = 10_000;

export default class VoxPlugin extends Plugin {
  private currentWatcher: FSWatcher;
  private settingsQueue: PQueue;

  private processor: TranscriptionProcessor;
  public settings: Settings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new VoxSettingTab(this));

    this.processor = new TranscriptionProcessor(this.app, this.settings);
    this.settingsQueue = new PQueue({ concurrency: 1 });

    // Give the app time to load in plugins and run its index check.
    await sleep(WATCHER_DELAY_MS);
    this.watchUnprocessedDirectory();
  }

  async onunload(): Promise<void> {
    this.processor.stop();
    this.currentWatcher?.removeAllListeners();
  }

  private watchUnprocessedDirectory() {
    // Reset the queue and re-collect files.
    this.processor.reset(this.settings);
    this.currentWatcher?.removeAllListeners();

    log("Resetting queue...");

    // First grab all the files that have yet to be processed.
    const unprocessedFiles = this.app.vault
      .getFiles()
      .filter((file) => file.path.startsWith(this.settings.watchDirectory))
      .map((tfile) => tfile.path);

    this.processor.queueFiles(unprocessedFiles);

    // Then watch for any changes...
    const filesListener: FilesListener = async (action, filename) => {
      // Found a new unprocessed audio file.
      if (action === "change") {
        const filepath = path.join(this.settings.watchDirectory, filename);
        return this.processor.queueFiles([filepath]);
      }
    };

    this.currentWatcher = this.app.vault.adapter.watchers[
      this.settings.watchDirectory
    ].watcher.addListener("change", filesListener) as FSWatcher;
  }

  async saveSettings(): Promise<void> {
    // If settings change quickly, we don't want to spam `watchUnprocessedDirectory`;
    // wait until there has been a 5 second gap after the last settings change before
    // reseting our watcher.
    this.settingsQueue.clear();

    // Settings changed; restart our watcher
    this.settingsQueue.add(() => sleep(WATCHER_DELAY_MS));
    this.settingsQueue.add(() => this.watchUnprocessedDirectory());

    return this.saveData(this.settings);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
}

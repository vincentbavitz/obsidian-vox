import {
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  Vault,
  debounce,
} from "obsidian";
import { DEFAULT_SETTINGS, Settings, VoxSettingTab } from "settings";
import { Logger } from "utils/log";
import { TranscriptionProcessor } from "./TranscriptionProcessor";

const WATCHER_DELAY_MS = 10_000;

export default class VoxPlugin extends Plugin {
  private logger: Logger;

  private processor: TranscriptionProcessor;
  public settings: Settings;

  async onload(): Promise<void> {
    // If settings change quickly, we don't want to spam `watchUnprocessedDirectory`;
    // wait a few seconds before reseting our watcher.
    this.watchUnprocessedDirectory = debounce(
      this.watchUnprocessedDirectory,
      WATCHER_DELAY_MS
    );

    await this.loadSettings();
    this.addSettingTab(new VoxSettingTab(this));

    this.logger = new Logger(this.manifest);
    this.processor = new TranscriptionProcessor(
      this.app,
      this.settings,
      this.logger
    );

    // Give the app time to load in plugins and run its index check.
    this.app.workspace.onLayoutReady(() => {
      this.watchUnprocessedDirectory();

      // Then watch for any changes...
      const queueFromWatcher = (file: TAbstractFile) => {
        if (file.path.includes(this.settings.watchDirectory)) {
          this.processor.queueFiles([file.path]);
        }
      };

      this.registerEvent(this.app.vault.on("create", queueFromWatcher));
      this.registerEvent(this.app.vault.on("rename", queueFromWatcher));
    });
  }

  async onunload(): Promise<void> {
    this.processor.stop();
  }

  private watchUnprocessedDirectory() {
    // Reset the queue and re-collect files.
    this.processor.reset(this.settings);
    this.logger.log("Resetting queue...");

    // First grab all the files that have yet to be processed.
    const unprocessedFiles: string[] = [];
    const folder = this.app.vault.getAbstractFileByPath(
      this.settings.watchDirectory
    );

    if (folder instanceof TFolder) {
      Vault.recurseChildren(folder, (file) => {
        if (file instanceof TFile) {
          unprocessedFiles.push(file.path);
        }
      });
    }

    this.processor.queueFiles(unprocessedFiles);
  }

  async saveSettings(): Promise<void> {
    this.watchUnprocessedDirectory();

    return this.saveData(this.settings);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
}

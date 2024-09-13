import { Plugin, TAbstractFile, debounce } from "obsidian";
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
    this.watchUnprocessedDirectory = debounce(this.watchUnprocessedDirectory, WATCHER_DELAY_MS);

    await this.loadSettings();
    this.addSettingTab(new VoxSettingTab(this));

    this.logger = new Logger(this.manifest);
    this.processor = new TranscriptionProcessor(this.app, this.settings, this.logger);

    // Give the app time to load in plugins and run its index check.
    this.app.workspace.onLayoutReady(() => {
      this.watchUnprocessedDirectory();

      // Then watch for any changes...
      const queueFromWatcher = async (file: TAbstractFile) => {
        if (file.path.includes(this.settings.watchDirectory)) {
          const transcribedFilesInfo = await this.processor.getTranscribedFiles();
          const candidate = await this.processor.getTranscribedStatus(file.path, transcribedFilesInfo);

          if (!candidate.isTranscribed) {
            this.processor.queueFiles([candidate]);
          }
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
    this.processor.getUnprocessedFiles().then((unprocessedFiles) => {
      this.processor.queueFiles(unprocessedFiles);
    });
  }

  async saveSettings(): Promise<void> {
    this.watchUnprocessedDirectory();

    return this.saveData(this.settings);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
}

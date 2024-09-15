import { Plugin, TAbstractFile, debounce } from "obsidian";
import { DEFAULT_SETTINGS, Settings, VoxSettingTab } from "settings";
import { Logger } from "utils/log";
import { TranscriptionProcessor } from "./TranscriptionProcessor";

const WATCHER_DELAY_MS = 10_000;

export default class VoxPlugin extends Plugin {
  public settings: Settings;

  // private debouncedQueueUnprocessedFiles: typeof this.queueUnprocessedFiles;
  private processor: TranscriptionProcessor;
  private logger: Logger;

  async onload(): Promise<void> {
    // If settings change quickly, we don't want to spam `queueUnprocessedFiles`; wait a few seconds before reseting our processor.
    this.queueUnprocessedFiles = debounce(this.queueUnprocessedFiles, WATCHER_DELAY_MS);

    await this.loadSettings();
    this.addSettingTab(new VoxSettingTab(this));

    this.logger = new Logger(this.manifest);
    this.processor = new TranscriptionProcessor(this.app, this.settings, this.logger);

    // Give the app time to load in plugins and run its index check.
    this.app.workspace.onLayoutReady(() => {
      this.queueUnprocessedFiles();

      // Then watch for any changes...
      const queueFromWatcher = async (file: TAbstractFile) => {
        if (file.path.includes(this.settings.watchDirectory)) {
          const transcribedFilesInfo = await this.processor.getTranscribedFiles();
          const candidate = await this.processor.getTranscribedStatus(file.path, transcribedFilesInfo);

          if (!candidate.isTranscribed) {
            this.processor.queueFile(candidate);
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

  private queueUnprocessedFiles() {
    // Reset the queue and re-collect files.
    this.processor.reset(this.settings);
    this.logger.log("Adding files to transcription queue.");

    // Queue a reasonable subset the files that have yet to be processed.
    this.processor.queueFiles();
  }

  async saveSettings(): Promise<void> {
    this.queueUnprocessedFiles();
    return this.saveData(this.settings);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
}

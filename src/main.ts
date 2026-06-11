import AudioRecorder from "AudioRecorder";
import matter from "gray-matter";
import { debounce, Notice, Plugin, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, Settings, VoxSettingTab } from "settings";
import { Logger } from "utils/log";
import { VOX_RECORDER_VIEW, VoxRecorderViewRenderer } from "view/VoxRecorderViewRenderer";
import { VOX_STATUS_VIEW, VoxStatusViewRenderer } from "view/VoxStatusViewRenderer";
import { SummarySelectorModal } from "view/modals/SummarySelectorModal";
import { SummarizationScheduler } from "./SummarizationScheduler";
import { TranscriptionProcessor } from "./TranscriptionProcessor";

const WATCHER_DELAY_MS = 10_000;
const HEALTH_CHECK_TIMEOUT_MS = 3000;

export default class VoxPlugin extends Plugin {
  public settings: Settings;

  private processor: TranscriptionProcessor;
  private scheduler: SummarizationScheduler;
  private recorder: AudioRecorder;
  private logger: Logger;

  // The sidebar leaf UI to view the current status
  private leaf: WorkspaceLeaf | null = null;

  async onload(): Promise<void> {
    // If settings change quickly, we don't want to spam `queueUnprocessedFiles`; wait a few seconds before reseting our processor.
    this.queueUnprocessedFiles = debounce(this.queueUnprocessedFiles, WATCHER_DELAY_MS);

    await this.loadSettings();
    this.addSettingTab(new VoxSettingTab(this));

    this.logger = new Logger(this.manifest);
    this.processor = new TranscriptionProcessor(this.app, this.settings, this.logger, this);
    this.scheduler = new SummarizationScheduler(this.app, this.settings, this.logger, this);
    this.recorder = new AudioRecorder();

    // Give the app time to load in plugins and run its index check.
    this.app.workspace.onLayoutReady(() => {
      // Check if backend is reachable
      this.checkBackendHealth();

      this.queueUnprocessedFiles();

      // Start recurring summary scheduler
      this.scheduler.start();

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

    // Register the status view.
    this.registerView(VOX_STATUS_VIEW, (leaf) => new VoxStatusViewRenderer(leaf, this.processor, this.scheduler));

    // Register the recorder view.
    this.registerView(
      VOX_RECORDER_VIEW,
      (leaf) => new VoxRecorderViewRenderer(leaf, this.processor, this.recorder, this),
    );

    this.addRibbonIcon("file-audio", "View VOX Status", () => this.activateView(VOX_STATUS_VIEW));
    this.addRibbonIcon("mic", "Record with VOX", () => this.activateView(VOX_RECORDER_VIEW));

    // Add summarization commands
    this.addCommand({
      id: "vox-generate-weekly-summary",
      name: "Generate Weekly Summary",
      callback: async () => {
        const periods = await this.scheduler.getAvailableWeeklyPeriods();
        new SummarySelectorModal(this.app, periods, async (id) => {
          await this.scheduler.generateWeeklySummary(id);
        }).open();
      },
    });

    this.addCommand({
      id: "vox-generate-monthly-summary",
      name: "Generate Monthly Summary",
      callback: async () => {
        const periods = await this.scheduler.getAvailableMonthlyPeriods();
        new SummarySelectorModal(this.app, periods, async (id) => {
          await this.scheduler.generateMonthlySummary(id);
        }).open();
      },
    });

    this.addCommand({
      id: "vox-generate-yearly-summary",
      name: "Generate Yearly Summary",
      callback: async () => {
        const periods = await this.scheduler.getAvailableYearlyPeriods();
        new SummarySelectorModal(this.app, periods, async (id) => {
          await this.scheduler.generateYearlySummary(id);
        }).open();
      },
    });

    // Single transcription summarization command
    this.addCommand({
      id: "vox-generate-single-summary",
      name: "Summarize This Note",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice("No file is currently active.");
          return;
        }

        const raw = await this.app.vault.adapter.read(file.path);
        const parsed = matter(raw);

        // Check frontmatter flag first (source of truth)
        const alreadySummarized = parsed.data.summarized === true;

        if (alreadySummarized) {
          new Notice("This note has already been summarized.");
          return;
        }

        await this.processor.summarizeTranscriptionFile(file.path);
      },
    });

    // Batch summarization command
    this.addCommand({
      id: "vox-generate-all-summaries",
      name: "Summarize All Notes",
      callback: async () => {
        const unsummarized = await this.processor.getSummarizationProcessor.getUnsummarizedTranscriptions();
        if (unsummarized.length === 0) {
          new Notice("All transcriptions have already been summarized!");
          return;
        }
        await this.processor.summarizeTranscriptionFiles(unsummarized.map((t) => t.filePath));
      },
    });
  }

  async onunload(): Promise<void> {
    this.processor.stop();
  }

  async saveSettings(): Promise<void> {
    this.queueUnprocessedFiles();
    this.scheduler.updateSettings(this.settings);
    return this.saveData(this.settings);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async activateView(type: string) {
    const { workspace } = this.app;

    const leaves = workspace.getLeavesOfType(type);

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      this.leaf = leaves[0];
    } else {
      // Our view could not be found in the workspace, create a new leaf
      // in the right sidebar for it
      this.leaf = workspace.getRightLeaf(false);

      await this.leaf.setViewState({ type, active: true });
    }

    // "Reveal" the leaf in case it is in a collapsed sidebar
    workspace.revealLeaf(this.leaf);
  }

  private queueUnprocessedFiles() {
    // Reset the queue and re-collect files.
    this.processor.reset(this.settings);
    this.logger.log("Adding files to transcription queue.");

    // Queue a reasonable subset the files that have yet to be processed.
    this.processor.queueFiles();
  }

  private async checkBackendHealth() {
    try {
      const backendUrl = this.settings.endpoint;
      const healthUrl = `${backendUrl}/health`;

      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout")), HEALTH_CHECK_TIMEOUT_MS),
      );

      // Race between the fetch and timeout
      const response = await Promise.race([
        fetch(healthUrl, { method: "GET" }).catch((error) => {
          throw new Error(`Fetch error: ${error.message}`);
        }),
        timeoutPromise,
      ]);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      this.logger.log(`Backend health check passed: ${backendUrl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log(`Backend health check failed: ${message}`);

      // Show warning notice to user
      new Notice(
        `⚠️ Vox backend unreachable. ` +
          `Please start docker-compose or update the backend URL in settings. ` +
          `(${this.settings.endpoint})`,
      );
    }
  }
}

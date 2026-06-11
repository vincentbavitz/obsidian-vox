import matter from "gray-matter";
import { DateTime } from "luxon";
import { randomUUID } from "crypto";
import VoxPlugin from "main";
import { App, Notice, RequestUrlParam, requestUrl } from "obsidian";
import {
  RecurringSummaryItem,
  RecurringSummaryMap,
  RecurringSummaryPeriod,
  RecurringSummaryStatus,
  FileDetail,
} from "types";
import { Logger } from "utils/log";
import { MARKDOWN_DATE_FORMAT, OBSIDIAN_API_KEY_HEADER_KEY, OBSIDIAN_VAULT_ID_HEADER_KEY } from "../constants";
import { Settings } from "../settings";

const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const APPROX_TOKENS_LIMIT = 120_000;
const LOOKBACK_WEEKS = 8;
const LOOKBACK_MONTHS = 13;
const LOOKBACK_YEARS = 3;

export type SummarizationSchedulerState = {
  items: RecurringSummaryMap;
};

type StateSubscriberMap = Record<string, (state: SummarizationSchedulerState) => void>;

type TranscriptEntry = {
  title: string;
  recordedAt: DateTime;
  category: string;
  text: string;
  filePath: string;
};

type SummaryEntry = {
  title: string;
  content: string;
  period: RecurringSummaryPeriod;
  filePath: string;
};

type PeriodRange = {
  id: string;
  label: string;
  start: DateTime;
  end: DateTime;
  outputPath: string;
  period: RecurringSummaryPeriod;
};

export type PeriodInfo = {
  id: string;
  label: string;
  range: PeriodRange;
  noteCount: number;
  summaryCount?: number;
  summaryExists: boolean;
  isReady: boolean;
  readinessReason?: string;
};

/**
 * SummarizationScheduler handles recurring (weekly/monthly/yearly) summaries.
 * Uses a pub/sub pattern similar to TranscriptionProcessor.
 */
export class SummarizationScheduler {
  public state: SummarizationSchedulerState;
  private subscribers: StateSubscriberMap = {};
  private intervalId: number | null = null;

  constructor(
    private readonly app: App,
    private settings: Settings,
    private readonly logger: Logger,
    private readonly plugin: VoxPlugin,
  ) {
    this.state = { items: {} };
  }

  /**
   * Start the scheduler with registerInterval + immediate check.
   */
  public start() {
    // Register the interval — Obsidian auto-cleans on unload
    this.plugin.registerInterval(window.setInterval(() => this.runChecks(), SCHEDULER_INTERVAL_MS));

    // Run once after a short delay to give vault index time to settle
    setTimeout(() => this.runChecks(), 5000);
  }

  /**
   * Subscribe to updates on the scheduler's state.
   */
  public subscribe(callback: (state: SummarizationSchedulerState) => void) {
    const subscriberId = randomUUID();
    this.subscribers[subscriberId] = callback;
    return () => this.unsubscribe(subscriberId);
  }

  private unsubscribe(subscriberId: string) {
    delete this.subscribers[subscriberId];
  }

  /**
   * Notify all subscribers of state changes.
   */
  private notifySubscribers() {
    Object.values(this.subscribers).forEach((fn) => fn?.(this.state));
  }

  /**
   * Update settings (called by plugin when settings change).
   */
  public updateSettings(settings: Settings) {
    this.settings = settings;
  }

  /**
   * Main scheduler loop — checks each enabled interval type.
   */
  private async runChecks(): Promise<void> {
    const now = DateTime.now();

    if (this.settings.shouldEnableWeeklySummaries) {
      await this.checkWeekly(now);
    }
    if (this.settings.shouldEnableMonthlySummaries) {
      await this.checkMonthly(now);
    }
    if (this.settings.shouldEnableYearlySummaries) {
      await this.checkYearly(now);
    }
  }

  /**
   * Check for weeks that need summarization (auto-generation only).
   */
  private async checkWeekly(now: DateTime): Promise<void> {
    const weeks: PeriodRange[] = [];

    // Look back N weeks from today
    for (let i = 0; i < LOOKBACK_WEEKS; i++) {
      const ref = now.minus({ weeks: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.WEEKLY, ref);

      // Only process completed weeks
      if (!this.isCompleted(range)) continue;

      // Skip if summary already exists (immutable)
      if (await this.summaryFileExists(range.outputPath)) continue;

      weeks.push(range);
    }

    // Generate summaries for weeks that are ready
    for (const week of weeks) {
      await this.generateWeeklySummaryInternal(week);
    }
  }

  /**
   * Check for months that need summarization (auto-generation only).
   */
  private async checkMonthly(now: DateTime): Promise<void> {
    const months: PeriodRange[] = [];

    // Look back N months from today
    for (let i = 0; i < LOOKBACK_MONTHS; i++) {
      const ref = now.minus({ months: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.MONTHLY, ref);

      // Only process completed months
      if (!this.isCompleted(range)) continue;

      // Skip if summary already exists (immutable)
      if (await this.summaryFileExists(range.outputPath)) continue;

      months.push(range);
    }

    // Generate summaries for months that are ready
    for (const month of months) {
      await this.generateMonthlySummaryInternal(month);
    }
  }

  /**
   * Check for years that need summarization (auto-generation only).
   */
  private async checkYearly(now: DateTime): Promise<void> {
    const years: PeriodRange[] = [];

    // Look back N years from today
    for (let i = 0; i < LOOKBACK_YEARS; i++) {
      const ref = now.minus({ years: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.YEARLY, ref);

      // Only process completed years
      if (!this.isCompleted(range)) continue;

      // Skip if summary already exists (immutable)
      if (await this.summaryFileExists(range.outputPath)) continue;

      years.push(range);
    }

    // Generate summaries for years that are ready
    for (const year of years) {
      await this.generateYearlySummaryInternal(year);
    }
  }

  /**
   * Get available weekly periods for the command modal.
   */
  public async getAvailableWeeklyPeriods(): Promise<PeriodInfo[]> {
    const periods: PeriodInfo[] = [];
    const now = DateTime.now();

    for (let i = 0; i < LOOKBACK_WEEKS; i++) {
      const ref = now.minus({ weeks: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.WEEKLY, ref);

      const notes = await this.collectTranscriptionsForPeriod(range.start, range.end);
      const allSummarized = await this.allNotesAreSummarized(notes);

      let isReady = true;
      let readinessReason: string | undefined;

      if (notes.length === 0) {
        isReady = false;
        readinessReason = "No notes in this period";
      } else if (this.settings.shouldSummarize && !allSummarized) {
        isReady = false;
        const unsummarizedCount = (
          await Promise.all(
            notes.map(async (n) => {
              const summaryExists = await this.summaryFileExists(
                `${this.settings.summaryDirectory}/${n.title.replace(/^TXC\s-\s/, "SUM - ")}.md`,
              );
              return !summaryExists;
            }),
          )
        ).filter(Boolean).length;
        readinessReason = `${unsummarizedCount} note(s) pending summarization`;
      }

      const summaryExists = await this.summaryFileExists(range.outputPath);

      periods.push({
        id: range.id,
        label: range.label,
        range,
        noteCount: notes.length,
        summaryExists,
        isReady,
        readinessReason,
      });
    }

    return periods;
  }

  /**
   * Get available monthly periods for the command modal.
   */
  public async getAvailableMonthlyPeriods(): Promise<PeriodInfo[]> {
    const periods: PeriodInfo[] = [];
    const now = DateTime.now();

    for (let i = 0; i < LOOKBACK_MONTHS; i++) {
      const ref = now.minus({ months: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.MONTHLY, ref);

      const weeklySummaries = await this.collectWeeklySummariesForMonth(range.start, range.end);

      let isReady = true;
      let readinessReason: string | undefined;

      if (weeklySummaries.length === 0) {
        isReady = false;
        readinessReason = "No weekly summaries in this period";
      } else if (this.settings.shouldEnableWeeklySummaries) {
        // Check if all weeks in this month have summaries
        const weeksInMonth = this.getWeeksInMonth(range.start, range.end);
        if (weeklySummaries.length < weeksInMonth.length) {
          isReady = false;
          readinessReason = `${weeksInMonth.length - weeklySummaries.length} week(s) missing summaries`;
        }
      }

      const summaryExists = await this.summaryFileExists(range.outputPath);

      periods.push({
        id: range.id,
        label: range.label,
        range,
        noteCount: weeklySummaries.length,
        summaryCount: weeklySummaries.length,
        summaryExists,
        isReady,
        readinessReason,
      });
    }

    return periods;
  }

  /**
   * Get available yearly periods for the command modal.
   */
  public async getAvailableYearlyPeriods(): Promise<PeriodInfo[]> {
    const periods: PeriodInfo[] = [];
    const now = DateTime.now();

    for (let i = 0; i < LOOKBACK_YEARS; i++) {
      const ref = now.minus({ years: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.YEARLY, ref);

      const monthlySummaries = await this.collectMonthlySummariesForYear(range.start, range.end);

      let isReady = true;
      let readinessReason: string | undefined;

      if (monthlySummaries.length === 0) {
        isReady = false;
        readinessReason = "No monthly summaries in this period";
      } else if (this.settings.shouldEnableMonthlySummaries) {
        // Check if all months in this year have summaries
        const monthsInYear = this.getMonthsInYear(range.start, range.end);
        if (monthlySummaries.length < monthsInYear.length) {
          isReady = false;
          readinessReason = `${monthsInYear.length - monthlySummaries.length} month(s) missing summaries`;
        }
      }

      const summaryExists = await this.summaryFileExists(range.outputPath);

      periods.push({
        id: range.id,
        label: range.label,
        range,
        noteCount: monthlySummaries.length,
        summaryCount: monthlySummaries.length,
        summaryExists,
        isReady,
        readinessReason,
      });
    }

    return periods;
  }

  /**
   * Trigger weekly summary generation (called by command).
   * Confirms if overwriting.
   */
  public async generateWeeklySummary(periodId: string): Promise<void> {
    const now = DateTime.now();
    const range = this.findWeeklyPeriod(periodId, now);
    if (!range) return;

    await this.generateWeeklySummaryInternal(range, true);
  }

  /**
   * Trigger monthly summary generation (called by command).
   * Confirms if overwriting.
   */
  public async generateMonthlySummary(periodId: string): Promise<void> {
    const now = DateTime.now();
    const range = this.findMonthlyPeriod(periodId, now);
    if (!range) return;

    await this.generateMonthlySummaryInternal(range, true);
  }

  /**
   * Trigger yearly summary generation (called by command).
   * Confirms if overwriting.
   */
  public async generateYearlySummary(periodId: string): Promise<void> {
    const now = DateTime.now();
    const range = this.findYearlyPeriod(periodId, now);
    if (!range) return;

    await this.generateYearlySummaryInternal(range, true);
  }

  /**
   * Internal: Generate weekly summary (auto or command-triggered).
   */
  private async generateWeeklySummaryInternal(range: PeriodRange, userTriggered = false): Promise<void> {
    try {
      this.setItemStatus(range.id, {
        period: RecurringSummaryPeriod.WEEKLY,
        label: range.label,
        status: RecurringSummaryStatus.GENERATING,
        startDate: range.start,
        endDate: range.end,
        addedAt: new Date(),
        finalizedAt: null,
      });

      const notes = await this.collectTranscriptionsForPeriod(range.start, range.end);
      if (notes.length === 0) {
        this.logger.log(`No notes found for weekly summary ${range.id}`);
        this.setItemStatus(range.id, { status: RecurringSummaryStatus.COMPLETE, finalizedAt: new Date() });
        return;
      }

      // Check if we're waiting for individual summaries
      if (this.settings.shouldSummarize) {
        const allSummarized = await this.allNotesAreSummarized(notes);
        if (!allSummarized && !userTriggered) {
          this.logger.log(`Not all notes are summarized yet for week ${range.id}`);
          this.setItemStatus(range.id, { status: RecurringSummaryStatus.PENDING, finalizedAt: null });
          return;
        }
      }

      // Group notes by category
      const grouped = this.groupByCategory(notes);

      // Build prompt and text, checking token limit
      const allRawText = Object.values(grouped)
        .flatMap((entries) => entries.map((e) => e.text))
        .join("\n\n---\n\n");

      let useNoteSummaries = false;
      if (this.estimateTokens(allRawText) > APPROX_TOKENS_LIMIT) {
        this.logger.log(`Weekly summary ${range.id} exceeds token limit, falling back to note summaries`);
        useNoteSummaries = true;
      }

      const { prompt, text } = await this.buildWeeklyPromptAndText(
        RecurringSummaryPeriod.WEEKLY,
        range.label,
        range.start,
        range.end,
        grouped,
        useNoteSummaries,
      );

      // Call API
      const summary = await this.callSummarizeApi(text, prompt);
      if (!summary) {
        throw new Error("API returned no summary");
      }

      // Build linked sources list
      const sourceLinks = notes.map((n) => `- [[${n.title}]]`).join("\n");
      const body = `${summary}\n\n---\n\n## Source Notes\n\n${sourceLinks}`;

      const frontmatter = {
        title: range.label,
        type: "recurring_summary",
        period: "weekly",
        period_start: range.start.toFormat(MARKDOWN_DATE_FORMAT),
        period_end: range.end.toFormat(MARKDOWN_DATE_FORMAT),
        generated_at: DateTime.now().toFormat(MARKDOWN_DATE_FORMAT),
      };

      const markdown = matter.stringify(body, frontmatter);

      // Write to file
      await this.app.vault.adapter.mkdir(this.settings.summaryDirectory + "/Weekly");
      await this.app.vault.adapter.write(range.outputPath, markdown);

      this.logger.log(`Weekly summary generated: ${range.id}`);
      new Notice(`Weekly summary created: ${range.label}`);

      this.setItemStatus(range.id, { status: RecurringSummaryStatus.COMPLETE, finalizedAt: new Date() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log(`Failed to generate weekly summary ${range.id}: ${message}`);
      new Notice(`⚠️ Failed to generate weekly summary: ${message}`);
      this.setItemStatus(range.id, { status: RecurringSummaryStatus.FAILED, finalizedAt: new Date() });
    }
  }

  /**
   * Internal: Generate monthly summary (auto or command-triggered).
   */
  private async generateMonthlySummaryInternal(range: PeriodRange, userTriggered = false): Promise<void> {
    try {
      this.setItemStatus(range.id, {
        period: RecurringSummaryPeriod.MONTHLY,
        label: range.label,
        status: RecurringSummaryStatus.GENERATING,
        startDate: range.start,
        endDate: range.end,
        addedAt: new Date(),
        finalizedAt: null,
      });

      const weeklySummaries = await this.collectWeeklySummariesForMonth(range.start, range.end);
      if (weeklySummaries.length === 0) {
        this.logger.log(`No weekly summaries found for monthly summary ${range.id}`);
        this.setItemStatus(range.id, { status: RecurringSummaryStatus.COMPLETE, finalizedAt: new Date() });
        return;
      }

      // Check if all weeks have summaries
      if (this.settings.shouldEnableWeeklySummaries && !userTriggered) {
        const weeksInMonth = this.getWeeksInMonth(range.start, range.end);
        if (weeklySummaries.length < weeksInMonth.length) {
          this.logger.log(`Not all weeks have summaries for month ${range.id}`);
          this.setItemStatus(range.id, { status: RecurringSummaryStatus.PENDING, finalizedAt: null });
          return;
        }
      }

      const { prompt, text } = this.buildMonthlyPromptAndText(
        RecurringSummaryPeriod.MONTHLY,
        range.label,
        weeklySummaries,
      );

      // Call API
      const summary = await this.callSummarizeApi(text, prompt);
      if (!summary) {
        throw new Error("API returned no summary");
      }

      // Build linked sources list
      const sourceLinks = weeklySummaries.map((s) => `- [[${s.title}]]`).join("\n");
      const body = `${summary}\n\n---\n\n## Source Summaries\n\n${sourceLinks}`;

      const frontmatter = {
        title: range.label,
        type: "recurring_summary",
        period: "monthly",
        period_start: range.start.toFormat(MARKDOWN_DATE_FORMAT),
        period_end: range.end.toFormat(MARKDOWN_DATE_FORMAT),
        generated_at: DateTime.now().toFormat(MARKDOWN_DATE_FORMAT),
      };

      const markdown = matter.stringify(body, frontmatter);

      // Write to file
      await this.app.vault.adapter.mkdir(this.settings.summaryDirectory + "/Monthly");
      await this.app.vault.adapter.write(range.outputPath, markdown);

      this.logger.log(`Monthly summary generated: ${range.id}`);
      new Notice(`Monthly summary created: ${range.label}`);

      this.setItemStatus(range.id, { status: RecurringSummaryStatus.COMPLETE, finalizedAt: new Date() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log(`Failed to generate monthly summary ${range.id}: ${message}`);
      new Notice(`⚠️ Failed to generate monthly summary: ${message}`);
      this.setItemStatus(range.id, { status: RecurringSummaryStatus.FAILED, finalizedAt: new Date() });
    }
  }

  /**
   * Internal: Generate yearly summary (auto or command-triggered).
   */
  private async generateYearlySummaryInternal(range: PeriodRange, userTriggered = false): Promise<void> {
    try {
      this.setItemStatus(range.id, {
        period: RecurringSummaryPeriod.YEARLY,
        label: range.label,
        status: RecurringSummaryStatus.GENERATING,
        startDate: range.start,
        endDate: range.end,
        addedAt: new Date(),
        finalizedAt: null,
      });

      const monthlySummaries = await this.collectMonthlySummariesForYear(range.start, range.end);
      if (monthlySummaries.length === 0) {
        this.logger.log(`No monthly summaries found for yearly summary ${range.id}`);
        this.setItemStatus(range.id, { status: RecurringSummaryStatus.COMPLETE, finalizedAt: new Date() });
        return;
      }

      // Check if all months have summaries
      if (this.settings.shouldEnableMonthlySummaries && !userTriggered) {
        const monthsInYear = this.getMonthsInYear(range.start, range.end);
        if (monthlySummaries.length < monthsInYear.length) {
          this.logger.log(`Not all months have summaries for year ${range.id}`);
          this.setItemStatus(range.id, { status: RecurringSummaryStatus.PENDING, finalizedAt: null });
          return;
        }
      }

      const { prompt, text } = this.buildYearlyPromptAndText(
        RecurringSummaryPeriod.YEARLY,
        range.label,
        monthlySummaries,
      );

      // Call API
      const summary = await this.callSummarizeApi(text, prompt);
      if (!summary) {
        throw new Error("API returned no summary");
      }

      // Build linked sources list
      const sourceLinks = monthlySummaries.map((s) => `- [[${s.title}]]`).join("\n");
      const body = `${summary}\n\n---\n\n## Source Summaries\n\n${sourceLinks}`;

      const frontmatter = {
        title: range.label,
        type: "recurring_summary",
        period: "yearly",
        period_start: range.start.toFormat(MARKDOWN_DATE_FORMAT),
        period_end: range.end.toFormat(MARKDOWN_DATE_FORMAT),
        generated_at: DateTime.now().toFormat(MARKDOWN_DATE_FORMAT),
      };

      const markdown = matter.stringify(body, frontmatter);

      // Write to file
      await this.app.vault.adapter.mkdir(this.settings.summaryDirectory + "/Yearly");
      await this.app.vault.adapter.write(range.outputPath, markdown);

      this.logger.log(`Yearly summary generated: ${range.id}`);
      new Notice(`Yearly summary created: ${range.label}`);

      this.setItemStatus(range.id, { status: RecurringSummaryStatus.COMPLETE, finalizedAt: new Date() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log(`Failed to generate yearly summary ${range.id}: ${message}`);
      new Notice(`⚠️ Failed to generate yearly summary: ${message}`);
      this.setItemStatus(range.id, { status: RecurringSummaryStatus.FAILED, finalizedAt: new Date() });
    }
  }

  // ===== Helper Methods =====

  private getPeriodRange(period: RecurringSummaryPeriod, ref: DateTime): PeriodRange {
    switch (period) {
      case RecurringSummaryPeriod.WEEKLY: {
        const start = ref.startOf("week");
        const end = ref.endOf("week");
        const id = `${start.toFormat("yyyy")}-W${start.toFormat("WW")}`;
        const label = `Week of ${start.toFormat("LLL d")}–${end.toFormat("d, yyyy")}`;
        const outputPath = `${this.settings.summaryDirectory}/Weekly/${id} Weekly Summary.md`;
        return { id, label, start, end, outputPath, period };
      }
      case RecurringSummaryPeriod.MONTHLY: {
        const start = ref.startOf("month");
        const end = ref.endOf("month");
        const id = start.toFormat("yyyy-MM");
        const label = start.toFormat("LLLL yyyy");
        const outputPath = `${this.settings.summaryDirectory}/Monthly/${id} Monthly Summary.md`;
        return { id, label, start, end, outputPath, period };
      }
      case RecurringSummaryPeriod.YEARLY: {
        const start = ref.startOf("year");
        const end = ref.endOf("year");
        const id = start.toFormat("yyyy");
        const label = `${id} Annual Summary`;
        const outputPath = `${this.settings.summaryDirectory}/Yearly/${id} Yearly Summary.md`;
        return { id, label, start, end, outputPath, period };
      }
    }
  }

  private isCompleted(range: PeriodRange): boolean {
    return range.end < DateTime.now();
  }

  private async summaryFileExists(path: string): Promise<boolean> {
    return await this.app.vault.adapter.exists(path);
  }

  private async allNotesAreSummarized(notes: TranscriptEntry[]): Promise<boolean> {
    for (const note of notes) {
      const summaryTitle = note.title.replace(/^TXC\s-\s/, "SUM - ");
      const summaryPath = `${this.settings.summaryDirectory}/${summaryTitle}.md`;
      const exists = await this.summaryFileExists(summaryPath);
      if (!exists) return false;
    }
    return true;
  }

  private async collectTranscriptionsForPeriod(start: DateTime, end: DateTime): Promise<TranscriptEntry[]> {
    const results: TranscriptEntry[] = [];

    const markdownFiles = this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith(this.settings.outputDirectory));

    for (const file of markdownFiles) {
      const raw = await this.app.vault.cachedRead(file);
      const parsed = matter(raw);

      // Only process transcriptions (not summaries)
      if (parsed.data.type !== "transcribed") continue;

      const recordedAt = DateTime.fromFormat(parsed.data.recorded_at as string, MARKDOWN_DATE_FORMAT);
      if (!recordedAt.isValid) continue;
      if (recordedAt < start || recordedAt > end) continue;

      results.push({
        title: (parsed.data.title as string) ?? file.basename,
        recordedAt,
        category: (parsed.data.voice_memo_category as string) ?? "Uncategorized",
        text: parsed.content.trim(),
        filePath: file.path,
      });
    }

    return results.sort((a, b) => a.recordedAt.toMillis() - b.recordedAt.toMillis());
  }

  private async collectWeeklySummariesForMonth(start: DateTime, end: DateTime): Promise<SummaryEntry[]> {
    const results: SummaryEntry[] = [];

    const weeklyDir = this.settings.summaryDirectory + "/Weekly";
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(weeklyDir));

    for (const file of files) {
      const raw = await this.app.vault.cachedRead(file);
      const parsed = matter(raw);

      if (parsed.data.type !== "recurring_summary" || parsed.data.period !== "weekly") continue;

      const periodStart = DateTime.fromFormat(parsed.data.period_start as string, MARKDOWN_DATE_FORMAT);
      if (!periodStart.isValid) continue;
      if (periodStart < start || periodStart > end) continue;

      results.push({
        title: (parsed.data.title as string) ?? file.basename,
        content: parsed.content.trim(),
        period: RecurringSummaryPeriod.WEEKLY,
        filePath: file.path,
      });
    }

    return results;
  }

  private async collectMonthlySummariesForYear(start: DateTime, end: DateTime): Promise<SummaryEntry[]> {
    const results: SummaryEntry[] = [];

    const monthlyDir = this.settings.summaryDirectory + "/Monthly";
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(monthlyDir));

    for (const file of files) {
      const raw = await this.app.vault.cachedRead(file);
      const parsed = matter(raw);

      if (parsed.data.type !== "recurring_summary" || parsed.data.period !== "monthly") continue;

      const periodStart = DateTime.fromFormat(parsed.data.period_start as string, MARKDOWN_DATE_FORMAT);
      if (!periodStart.isValid) continue;
      if (periodStart < start || periodStart > end) continue;

      results.push({
        title: (parsed.data.title as string) ?? file.basename,
        content: parsed.content.trim(),
        period: RecurringSummaryPeriod.MONTHLY,
        filePath: file.path,
      });
    }

    return results;
  }

  private groupByCategory(entries: TranscriptEntry[]): Record<string, TranscriptEntry[]> {
    const groups: Record<string, TranscriptEntry[]> = {};

    for (const entry of entries) {
      if (!groups[entry.category]) {
        groups[entry.category] = [];
      }
      groups[entry.category].push(entry);
    }

    return groups;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async buildWeeklyPromptAndText(
    period: RecurringSummaryPeriod,
    label: string,
    start: DateTime,
    end: DateTime,
    grouped: Record<string, TranscriptEntry[]>,
    useNoteSummaries: boolean,
  ): Promise<{ prompt: string; text: string }> {
    const startStr = start.toFormat("LLLL d, yyyy");
    const endStr = end.toFormat("LLLL d, yyyy");

    let systemPrompt = `You are an intelligent personal journal assistant. Generate a weekly summary of voice memos recorded between ${startStr} and ${endStr}.\n\n`;
    systemPrompt += `Organize by category. For each category, write "## {Category}s from this Week" with a comprehensive overview of key themes and events, entries in chronological order.\n\n`;
    systemPrompt += `After all categories, add a "## Key Themes" section identifying cross-category patterns.\n\n`;

    if (this.settings.recurringSummarySystemPrompt?.trim()) {
      systemPrompt += `${this.settings.recurringSummarySystemPrompt.trim()}\n\n`;
    }

    systemPrompt += `Here are the voice memo transcriptions organized by category:`;

    let textSections: string[] = [];

    if (useNoteSummaries) {
      // Fall back to using per-note summaries
      for (const [category, entries] of Object.entries(grouped)) {
        textSections.push(`### ${category}\n`);
        for (const entry of entries) {
          const summaryTitle = entry.title.replace(/^TXC\s-\s/, "SUM - ");
          const summaryPath = `${this.settings.summaryDirectory}/${summaryTitle}.md`;

          // Try to read the summary file
          try {
            const summaryContent = await this.app.vault.adapter.read(summaryPath);
            const parsed = matter(summaryContent);
            textSections.push(
              `**${entry.title}** (${entry.recordedAt.toFormat("LLL d, yyyy 'at' HH:mm")})\n${parsed.content.trim()}\n`,
            );
          } catch {
            // If summary doesn't exist, use the full transcription as fallback
            textSections.push(
              `**${entry.title}** (${entry.recordedAt.toFormat("LLL d, yyyy 'at' HH:mm")})\n${entry.text}\n`,
            );
          }
        }
      }
    } else {
      // Use full transcriptions
      for (const [category, entries] of Object.entries(grouped)) {
        textSections.push(`### ${category}\n`);
        for (const entry of entries) {
          textSections.push(
            `**${entry.title}** (${entry.recordedAt.toFormat("LLL d, yyyy 'at' HH:mm")})\n${entry.text}\n`,
          );
        }
      }
    }

    return {
      prompt: systemPrompt,
      text: textSections.join("\n---\n\n"),
    };
  }

  private buildMonthlyPromptAndText(
    period: RecurringSummaryPeriod,
    label: string,
    weeklySummaries: SummaryEntry[],
  ): { prompt: string; text: string } {
    let systemPrompt = `You are an intelligent personal journal assistant. Generate a monthly summary for ${label}.\n\n`;
    systemPrompt += `You are provided with the weekly summaries from this month. Synthesize them into a cohesive monthly narrative, preserving category structure where appropriate.\n\n`;

    if (this.settings.recurringSummarySystemPrompt?.trim()) {
      systemPrompt += `${this.settings.recurringSummarySystemPrompt.trim()}\n\n`;
    }

    systemPrompt += `Here are the weekly summaries from ${label}:`;

    const textSections = weeklySummaries.map(
      (s) => `**${s.title}**\n\n${s.content}`,
    );

    return {
      prompt: systemPrompt,
      text: textSections.join("\n\n---\n\n"),
    };
  }

  private buildYearlyPromptAndText(
    period: RecurringSummaryPeriod,
    label: string,
    monthlySummaries: SummaryEntry[],
  ): { prompt: string; text: string } {
    let systemPrompt = `You are an intelligent personal journal assistant. Generate a yearly summary for ${label}.\n\n`;
    systemPrompt += `You are provided with the monthly summaries from this year. Synthesize them into a cohesive annual narrative.\n\n`;

    if (this.settings.recurringSummarySystemPrompt?.trim()) {
      systemPrompt += `${this.settings.recurringSummarySystemPrompt.trim()}\n\n`;
    }

    systemPrompt += `Here are the monthly summaries from ${label}:`;

    const textSections = monthlySummaries.map(
      (s) => `**${s.title}**\n\n${s.content}`,
    );

    return {
      prompt: systemPrompt,
      text: textSections.join("\n\n---\n\n"),
    };
  }

  private async callSummarizeApi(text: string, prompt: string): Promise<string | null> {
    const host = this.settings.endpoint;
    const url = `${host}/summarize`;

    const request: RequestUrlParam = {
      url,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({ text, prompt }),
      headers: {
        [OBSIDIAN_VAULT_ID_HEADER_KEY]: this.app.appId,
        [OBSIDIAN_API_KEY_HEADER_KEY]: this.settings.apiKey,
      },
      throw: false,
    };

    try {
      const response = await requestUrl(request);

      if (response.status !== 200) {
        console.warn("Summarization API error:", response.status, response.text);
        return null;
      }

      const summary = response.json?.summary as string;
      if (!summary) {
        console.warn("Summarization API returned no summary field");
        return null;
      }

      return summary;
    } catch (error: unknown) {
      console.warn("Summarization API call failed:", error);
      return null;
    }
  }

  private setItemStatus(id: string, update: Partial<RecurringSummaryItem>): void {
    if (!this.state.items[id]) {
      // Create new item
      this.state.items[id] = {
        id,
        period: update.period!,
        label: update.label!,
        status: update.status!,
        startDate: update.startDate!,
        endDate: update.endDate!,
        addedAt: update.addedAt!,
        finalizedAt: update.finalizedAt ?? null,
      };
    } else {
      // Update existing item
      this.state.items[id] = {
        ...this.state.items[id],
        ...update,
      };
    }

    this.notifySubscribers();
  }

  private findWeeklyPeriod(id: string, now: DateTime): PeriodRange | null {
    for (let i = 0; i < LOOKBACK_WEEKS; i++) {
      const ref = now.minus({ weeks: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.WEEKLY, ref);
      if (range.id === id) return range;
    }
    return null;
  }

  private findMonthlyPeriod(id: string, now: DateTime): PeriodRange | null {
    for (let i = 0; i < LOOKBACK_MONTHS; i++) {
      const ref = now.minus({ months: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.MONTHLY, ref);
      if (range.id === id) return range;
    }
    return null;
  }

  private findYearlyPeriod(id: string, now: DateTime): PeriodRange | null {
    for (let i = 0; i < LOOKBACK_YEARS; i++) {
      const ref = now.minus({ years: i });
      const range = this.getPeriodRange(RecurringSummaryPeriod.YEARLY, ref);
      if (range.id === id) return range;
    }
    return null;
  }

  private getWeeksInMonth(start: DateTime, end: DateTime): DateTime[] {
    const weeks: DateTime[] = [];
    let current = start.startOf("week");

    while (current <= end) {
      weeks.push(current);
      current = current.plus({ weeks: 1 });
    }

    return weeks;
  }

  private getMonthsInYear(start: DateTime, end: DateTime): DateTime[] {
    const months: DateTime[] = [];
    let current = start.startOf("month");

    while (current <= end) {
      months.push(current);
      current = current.plus({ months: 1 });
    }

    return months;
  }
}

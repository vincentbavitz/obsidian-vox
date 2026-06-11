import matter from "gray-matter";
import { App, Notice, RequestUrlParam, requestUrl } from "obsidian";
import { Settings } from "settings";
import { Logger } from "utils/log";
import { OBSIDIAN_API_KEY_HEADER_KEY, OBSIDIAN_VAULT_ID_HEADER_KEY } from "../constants";

export type TranscriptionInfo = {
  title: string;
  filePath: string;
  recordedAt: string;
};

export class SummarizationProcessor {
  constructor(
    private readonly app: App,
    private settings: Settings,
    private readonly logger: Logger,
  ) {}

  public updateSettings(settings: Settings) {
    this.settings = settings;
  }

  /**
   * Get all transcriptions that haven't been summarized yet.
   * Checks frontmatter 'summarized' flag first (source of truth), then falls back to file existence.
   */
  public async getUnsummarizedTranscriptions(): Promise<TranscriptionInfo[]> {
    const unsummarized: TranscriptionInfo[] = [];

    const markdownFiles = this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith(this.settings.outputDirectory));

    for (const file of markdownFiles) {
      const raw = await this.app.vault.adapter.read(file.path);
      const parsed = matter(raw);

      // Only process transcriptions (not summaries)
      if (parsed.data.type !== "transcribed") continue;

      const title = (parsed.data.title as string) ?? file.basename;
      const recordedAt = (parsed.data.recorded_at as string) ?? "Unknown";

      // Check frontmatter flag first (source of truth)
      const alreadySummarized = parsed.data.summarized === true;
      if (alreadySummarized) continue;

      // Fall back to checking if summary file exists (for backwards compatibility)
      const summaryTitle = title.replace(/^TXC\s-\s/, "SUM - ");
      const summaryPath = `${this.settings.summaryDirectory}/${summaryTitle}.md`;
      const summaryExists = await this.app.vault.adapter.exists(summaryPath);

      if (!summaryExists) {
        unsummarized.push({
          title,
          filePath: file.path,
          recordedAt,
        });
      }
    }

    // Sort by recorded_at descending (newest first)
    return unsummarized.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }

  /**
   * Summarize a transcription by its file path.
   * Used for manual summarization of single notes.
   */
  public async summarizeTranscriptionByPath(transcriptionFilePath: string): Promise<boolean> {
    try {
      const raw = await this.app.vault.adapter.read(transcriptionFilePath);
      const parsed = matter(raw);

      const transcriptText = parsed.content.trim();
      if (!transcriptText) {
        new Notice("⚠️ Transcription file is empty");
        return false;
      }

      await this.summarizeTranscription(transcriptText, transcriptionFilePath);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log(`Failed to summarize by path: ${message}`);
      new Notice(`⚠️ Failed to summarize: ${message}`);
      return false;
    }
  }

  /**
   * Summarize a transcription and write both the summary file and cross-links.
   * Non-fatal — failures are logged and noticed but don't fail the transcription.
   */
  public async summarizeTranscription(transcriptText: string, transcriptionFilePath: string): Promise<void> {
    try {
      this.logger.log(`Summarizing transcription: ${transcriptionFilePath}`);

      // Build the prompt
      const userPrompt = this.buildPerTranscriptionPrompt();

      // Call the API
      const summary = await this.callSummarizeApi(transcriptText, userPrompt);
      if (!summary) {
        this.logger.log("Summarization API returned no content");
        new Notice("⚠️ Failed to summarize transcription: empty response from API");
        return;
      }

      // Get the transcription file title from the markdown
      const tfile = this.app.vault.getAbstractFileByPath(transcriptionFilePath);
      if (!tfile) {
        throw new Error(`Transcription file not found: ${transcriptionFilePath}`);
      }

      const transcriptionContent = await this.app.vault.adapter.read(transcriptionFilePath);
      const parsed = matter(transcriptionContent);
      const transcriptionTitle = parsed.data.title as string;

      // Derive summary title by replacing TXC prefix with SUM
      const summaryTitle = transcriptionTitle.replace(/^TXC\s-\s/, "SUM - ");

      // Write summary file
      const summaryPath = await this.writeSummaryFile(summaryTitle, summary, transcriptionFilePath);

      // Append backlink to transcription file
      await this.appendBacklinkToTranscription(transcriptionFilePath, summaryTitle);

      this.logger.log(`Summarization complete: ${summaryPath}`);
      new Notice(`Summary created: ${summaryTitle}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.log(`Summarization failed: ${message}`);
      new Notice(`⚠️ Failed to summarize transcription: ${message}`);
      // Don't rethrow — this is non-fatal
    }
  }

  private buildPerTranscriptionPrompt(): string {
    const defaultPrompt =
      "Please summarize the following voice memo transcription concisely using Markdown syntax.\nFocus on key points, decisions, and insights.";

    if (this.settings.summarizationSystemPrompt?.trim()) {
      return defaultPrompt + "\n\n" + this.settings.summarizationSystemPrompt.trim();
    }

    return defaultPrompt;
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

  private async writeSummaryFile(
    summaryTitle: string,
    summaryContent: string,
    transcriptionFilePath: string,
  ): Promise<string> {
    // Extract the transcription title from the file path for the header link
    const transcriptionTitleMatch = transcriptionFilePath.match(/\/([^/]+)\.md$/);
    const transcriptionFileName = transcriptionTitleMatch ? transcriptionTitleMatch[1] : "transcription";

    // Build the summary markdown with a header link back to the transcription
    const summaryBody = `[[${transcriptionFileName}]]\n\n${summaryContent}`;

    const frontmatter = {
      title: summaryTitle,
      type: "summary",
      generated_at: new Date().toISOString(),
    };

    const summaryMarkdown = matter.stringify(summaryBody, frontmatter);

    // Write to summaryDirectory
    const summaryPath = `${this.settings.summaryDirectory}/${summaryTitle}.md`;

    // Ensure directory exists
    const summaryDir = this.settings.summaryDirectory;
    await this.app.vault.adapter.mkdir(summaryDir);

    // Write the file
    await this.app.vault.adapter.write(summaryPath, summaryMarkdown);

    return summaryPath;
  }

  private async appendBacklinkToTranscription(transcriptionFilePath: string, summaryTitle: string): Promise<void> {
    // Read the existing transcription file
    const content = await this.app.vault.adapter.read(transcriptionFilePath);

    // Parse the frontmatter to add the summarized flag
    const parsed = matter(content);
    parsed.data.summarized = true;

    // Append the summary backlink to the body
    const backlink = `\n\n---\n**Summary:** [[${summaryTitle}]]`;
    const updatedBody = parsed.content + backlink;

    // Re-stringify with updated frontmatter
    const updatedContent = matter.stringify(updatedBody, parsed.data);

    // Write back
    await this.app.vault.adapter.write(transcriptionFilePath, updatedContent);
  }
}

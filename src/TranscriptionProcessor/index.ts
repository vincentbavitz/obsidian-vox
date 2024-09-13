import { AudioProcessor } from "AudioProcessor";
import { MarkdownProcessor } from "MarkdownProcessor";
import axios, { HttpStatusCode, isAxiosError } from "axios";
import matter from "gray-matter";
import { sha1 } from "hash-wasm";
import { App, Notice, TFile, TFolder, Vault } from "obsidian";
import PQueue from "p-queue";
import { FileDetail, MarkdownOutput, TranscriptionResponse } from "types";
import { extractFileDetail } from "utils/format";
import { Logger } from "utils/log";
import { PUBLIC_API_ENDPOINT } from "../constants";
import { Settings } from "../settings";

type TranscribedItem = {
  originalAudioFileName: string;
  originalAudioFileHash: string;
};

/**
 * A file which is potentially available to be transcribed.
 */
type TranscriptionCandidate = FileDetail & {
  isTranscribed: boolean;
  hash: string;
};

const ONE_MINUTE_IN_MS = 60_000;

/**
 * Process audio files into markdown content.
 */
export class TranscriptionProcessor {
  private markdownProcessor: MarkdownProcessor;
  private audioProcessor: AudioProcessor;
  private queue: PQueue;

  constructor(private readonly app: App, private settings: Settings, private readonly logger: Logger) {
    this.markdownProcessor = new MarkdownProcessor(app.vault, settings, logger);
    this.audioProcessor = new AudioProcessor(app.appId, app.vault, settings, logger);

    this.queue = new PQueue({ concurrency: 4 });

    // What if this setting changes? Requires restart?
    // this.queue.on('idle', )
  }

  public async queueFiles(audioFiles: TranscriptionCandidate[]) {
    if (audioFiles.length === 0) {
      return;
    }

    let items = 0;

    for (const audioFile of audioFiles) {
      this.queue.add(() => this.processFile(audioFile));
      items++;
    }

    if (items) {
      new Notice(`Added ${items} file${items > 1 ? "s" : ""} to the transcription queue.`);
    }
  }

  public stop() {
    this.queue.clear();
  }

  public reset(settings: Settings) {
    this.settings = settings;
    this.queue.clear();
  }

  private async processFile(audioFile: TranscriptionCandidate) {
    try {
      const processedAudio = await this.audioProcessor.transformAudio(audioFile);
      const transcribed = await this.transcribe(processedAudio);

      if (transcribed && transcribed.segments) {
        const markdown = await this.markdownProcessor.generate(audioFile, processedAudio, audioFile.hash, transcribed);

        await this.consolidateFiles(audioFile, processedAudio, markdown);

        const notice = `Transcription complete: ${markdown.title}`;
        this.logger.log(notice);
        new Notice(notice);
      }
    } catch (error: unknown) {
      console.warn(error);
      if (isAxiosError(error)) {
        if (error.response?.status === HttpStatusCode.TooManyRequests) {
          new Notice("You've reached your transcription limit for today.");
        } else {
          new Notice("Error connecting to transcription host. Please check your settings.");
        }

        this.queue.pause();
      }
    }
  }

  private async transcribe(audioFile: FileDetail): Promise<TranscriptionResponse | null> {
    const host = this.settings.isSelfHosted ? this.settings.selfHostedEndpoint : PUBLIC_API_ENDPOINT;

    const url = `${host}/transcribe`;

    const mimetype = `audio/${audioFile.extension.replace(".", "")}`;

    const audioBinary = await this.app.vault.adapter.readBinary(audioFile.filepath);
    const audioBlob = new Blob([audioBinary], { type: mimetype });
    const audioBlobFile = new File([audioBlob], audioFile.filename, {
      type: mimetype,
    });

    try {
      const response = await axios.postForm<TranscriptionResponse>(
        url,
        {
          audio_file: audioBlobFile,
        },
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "obsidian-vault-id": this.app.appId,
          },
          timeout: 20 * ONE_MINUTE_IN_MS,
          responseType: "json",
        }
      );

      if (!response.data || response.status !== 200) {
        console.warn("Could not transcribe audio:", response);

        new Notice(`There was an issue transcribing audio: "${audioFile.filename}"`);
      }

      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.warn(error);
        new Notice("Error connecting to transcription host. Please check your settings.");

        return null;
      }
    }

    new Notice("There was an issue transcribing file.");
    return null;
  }

  /**
   * Move the generated markdown content and the processed audio to their
   * output location.
   */
  private async consolidateFiles(originalFile: FileDetail, processedAudio: FileDetail, markdown: MarkdownOutput) {
    const finalMarkdownLocation = String(this.settings.outputDirectory);
    const finalMarkdownFilepath = `${finalMarkdownLocation}/${markdown.title}.md`;

    const finalAudioLocation = `${finalMarkdownLocation}/audio`;
    const finalAudioFilepath = `${finalAudioLocation}/${processedAudio.filename}`;

    await this.app.vault.adapter.mkdir(finalMarkdownLocation);
    await this.app.vault.adapter.mkdir(finalAudioLocation);
    await this.app.vault.adapter.write(finalMarkdownFilepath, markdown.content);

    // Remove original file if the user desires
    if (this.settings.shouldDeleteOriginal) {
      await this.app.vault.adapter.remove(originalFile.filepath);
    }

    return {
      audioFile: finalAudioFilepath,
      markdownFile: finalMarkdownFilepath,
    };
  }

  /**
   * Get all files that have not already been processed, searching first by filename and then by hash.
   *
   * @note
   * Searching this way ensures that even as our filename transformation functions
   * change or evolve, we can always determine which file was transcribed.
   */
  public async getUnprocessedFiles() {
    const folder = this.app.vault.getAbstractFileByPath(this.settings.watchDirectory);

    const unprocessedAudioFiles: TranscriptionCandidate[] = [];
    const allPotentialAudioFiles: string[] = [];

    if (folder instanceof TFolder) {
      Vault.recurseChildren(folder, (file) => {
        if (file instanceof TFile) {
          allPotentialAudioFiles.push(file.path);
        }
      });
    }

    const transcribedFiles = await this.getTranscribedFiles();

    for (const filepath of allPotentialAudioFiles) {
      const candidate = await this.getTranscribedStatus(filepath, transcribedFiles);

      if (!candidate.isTranscribed) {
        unprocessedAudioFiles.push(candidate);
      }
    }

    return unprocessedAudioFiles;
  }

  public async getTranscribedFiles() {
    const transcribedFiles = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(this.settings.outputDirectory));

    const transcribedFilesInfo: TranscribedItem[] = await Promise.all(
      transcribedFiles.map(async (tfile) => {
        const cachedFile = await this.app.vault.cachedRead(tfile);
        const frontmatter = matter(cachedFile);

        const filename = frontmatter.data["original_file_name"];
        const hash = frontmatter.data["original_file_hash"];

        return {
          originalAudioFileName: (filename as string) ?? "",
          originalAudioFileHash: (hash as string) ?? "",
        };
      })
    );

    return transcribedFilesInfo;
  }

  public async getTranscribedStatus(
    filepath: string,
    transcribedItems: TranscribedItem[]
  ): Promise<TranscriptionCandidate> {
    const detail = extractFileDetail(filepath);

    // First look for a filename match in our transcribed items.
    const transcribedFoundByName = transcribedItems.find((item) => detail.filename === item.originalAudioFileName);

    if (transcribedFoundByName) {
      return {
        ...detail,
        isTranscribed: true,
        hash: transcribedFoundByName.originalAudioFileHash,
      };
    }

    // Counldn't find it by filename, so let's try by hash.
    // Calculating the hash here serves two purposes:
    //   - Checking if the file has already been transcribed
    //   - If already transcribed, we'll pass the hash to the MD processor to save to the frontmatter
    const audioBinary = await this.app.vault.adapter.readBinary(detail.filepath);
    const int8Buffer = new Uint8Array(audioBinary);
    const hash = await sha1(int8Buffer);

    const transcribedFoundByHash = transcribedItems.some((item) => hash === item.originalAudioFileHash);

    return { ...detail, isTranscribed: transcribedFoundByHash, hash };
  }
}

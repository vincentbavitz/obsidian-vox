import { AudioProcessor } from "AudioProcessor";
import { MarkdownProcessor } from "MarkdownProcessor";
import axios, { HttpStatusCode, isAxiosError } from "axios";
import { App, Notice } from "obsidian";
import PQueue from "p-queue";
import { FileDetail, MarkdownOutput, TranscriptionResponse } from "types";
import { extractFileDetail } from "utils/format";
import { Logger } from "utils/log";
import { PUBLIC_API_ENDPOINT } from "../constants";
import { Settings } from "../settings";

const ONE_MINUTE_IN_MS = 60_000;

/**
 * Process audio files into markdown content.
 */
export class TranscriptionProcessor {
  private markdownProcessor: MarkdownProcessor;
  private audioProcessor: AudioProcessor;
  private queue: PQueue;

  constructor(
    private readonly app: App,
    private settings: Settings,
    private readonly logger: Logger
  ) {
    this.markdownProcessor = new MarkdownProcessor(app.vault, settings, logger);
    this.audioProcessor = new AudioProcessor(
      app.appId,
      app.vault,
      settings,
      logger
    );

    this.queue = new PQueue({ concurrency: 4 });

    // What if this setting changes? Requires restart?
    // this.queue.on('idle', )
  }

  public async queueFiles(audioFilePaths: Array<string>) {
    if (audioFilePaths.length === 0) {
      return;
    }

    let items = 0;

    // We get the transcribed status here so that we don't
    // spam processFile with unnecessary calls.
    const transcribedAudioFiles =
      await this.audioProcessor.getTranscribedAudioFiles();

    for (const audioFilePath of audioFilePaths) {
      const audioFileDetail = extractFileDetail(audioFilePath);

      const isAlreadyTranscribed =
        await this.audioProcessor.getTranscribedStatus(
          audioFileDetail,
          transcribedAudioFiles
        );

      if (isAlreadyTranscribed) {
        continue;
      }

      this.queue.add(() => this.processFile(audioFileDetail));
      items++;
    }

    if (items) {
      new Notice(
        `Added ${items} file${items > 1 ? "s" : ""} to the transcription queue.`
      );
    }
  }

  public stop() {
    this.queue.clear();
  }

  public reset(settings: Settings) {
    this.settings = settings;
    this.queue.clear();
  }

  private async processFile(audioFile: FileDetail) {
    try {
      const processedAudio = await this.audioProcessor.transformAudio(
        audioFile
      );

      const transcribed = await this.transcribe(processedAudio);

      if (transcribed && transcribed.segments) {
        const markdown = await this.markdownProcessor.generate(
          audioFile,
          processedAudio,
          transcribed
        );

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
          new Notice(
            "Error connecting to transcription host. Please check your settings."
          );
        }

        this.queue.pause();
      }
    }
  }

  private async transcribe(
    audioFile: FileDetail
  ): Promise<TranscriptionResponse | null> {
    const host = this.settings.isSelfHosted
      ? this.settings.selfHostedEndpoint
      : PUBLIC_API_ENDPOINT;

    const url = `${host}/transcribe`;

    const mimetype = `audio/${audioFile.extension.replace(".", "")}`;

    const audioBinary = await this.app.vault.adapter.readBinary(
      audioFile.filepath
    );
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

        new Notice(
          `There was an issue transcribing audio: "${audioFile.filename}"`
        );
      }

      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        console.warn(error);
        new Notice(
          "Error connecting to transcription host. Please check your settings."
        );

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
  private async consolidateFiles(
    originalFile: FileDetail,
    processedAudio: FileDetail,
    markdown: MarkdownOutput
  ) {
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
}

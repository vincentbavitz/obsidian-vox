import axios from "axios";
import matter from "gray-matter";
import { Notice, Vault } from "obsidian";
import path from "path";
import { Settings } from "settings";
import { FileDetail } from "types";
import { extractFileDetail, getFileCreationDateTime } from "utils/format";
import { Logger } from "utils/log";
import {
  CATEGORY_REGEX_LEGACY,
  FILENAME_DATE_FORMAT,
  PUBLIC_API_ENDPOINT,
  generateCategoryRegex,
} from "../constants";

export class AudioProcessor {
  constructor(
    private readonly appId: string,
    private readonly vault: Vault,
    private settings: Settings,
    private readonly logger: Logger
  ) {}

  /**
   * Converts a voice note to the desired extension, and
   * generates a filesystem friendly filename, prefixed with
   * the recorded date and time.
   */
  public async transformAudio(audioFile: FileDetail): Promise<FileDetail> {
    // Is this actually an audio file?
    const validInputExtensions = [".wav", ".mp3", ".m4a", ".aac", ".ogg"];
    const desiredExtension = `.${this.settings.audioOutputExtension}`;

    if (
      !audioFile.extension ||
      !validInputExtensions.includes(audioFile.extension)
    ) {
      throw new Error("Error: Not an audio file or unacceptable format");
    }

    // Move file into the processing directory.
    const outputName = await this.cleanAudioFilename(audioFile);
    const outputFilename = `${outputName}${desiredExtension}`;
    const outputFileDetail = extractFileDetail(
      path.join(this.settings.outputDirectory, "audio", outputFilename)
    );

    // Convert the file to the correct file extension.
    const shouldConvertFile = audioFile.extension !== desiredExtension;

    if (shouldConvertFile) {
      this.logger.log(`Converting audio file: "${audioFile.filename}"`);

      // const url = `${this.settings.backendHost}/convert/audio`;
      const url = `${PUBLIC_API_ENDPOINT}/convert/audio`;

      const mimetype = `audio/${this.settings.audioOutputExtension}`;

      const audioBinary = await this.vault.adapter.readBinary(
        audioFile.filepath
      );

      const audioBlob = new Blob([audioBinary], { type: mimetype });
      const audioBlobFile = new File([audioBlob], audioFile.filename, {
        type: mimetype,
      });

      const response = await axios.postForm<Buffer>(
        url,
        {
          format: this.settings.audioOutputExtension,
          audio_file: audioBlobFile,
        },
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "obsidian-vault-id": this.appId,
          },
          responseType: "arraybuffer",
        }
      );

      if (!response.data || response.status !== 200) {
        const error =
          "There was an error converting audio during transcription.";

        new Notice(error);
        throw new Error(error);
      }

      await this.vault.adapter.mkdir(outputFileDetail.directory);
      await this.vault.adapter.writeBinary(
        outputFileDetail.filepath,
        response.data
      );
    } else {
      const exists = await this.vault.exists(outputFileDetail.filepath);

      if (!exists) {
        await this.vault.adapter.copy(
          audioFile.filepath,
          outputFileDetail.filepath
        );
      }
    }

    return outputFileDetail;
  }

  /**
   * Get the original names of the audio files which have been transcribed.
   *
   * @note
   * Searching this way ensures that even as our filename transformation functions
   * change or evolve, we can always determine which file was transcribed.
   */
  public async getTranscribedAudioFiles() {
    const transcribedFiles = this.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(this.settings.outputDirectory));

    const originalFilenamePromises = transcribedFiles.map(async (tfile) => {
      const cachedFile = await this.vault.cachedRead(tfile);
      const frontmatter = matter(cachedFile);
      const originalFilename = frontmatter.data["original_file_name"];
      return (originalFilename as string) ?? "";
    });

    const originalFileNames = await Promise.all(originalFilenamePromises);
    return originalFileNames.filter((filename) => filename.length);
  }

  /**
   * Determines if a particular audio file has already been transcribed
   * and placed into Obsidian.
   */
  public async getTranscribedStatus(
    audioFile: FileDetail,
    transcribedFilenames: string[]
  ) {
    const hasTranscribed = transcribedFilenames.contains(audioFile.filename);
    return hasTranscribed;
  }

  /**
   * Formats an audio file name to a standardized format.
   * @example "AAAA i caught a BIG fish.m4a" -> "20210715-02:02-i-caught-a-big-fish.m4a"
   */
  private cleanAudioFilename = async (file: FileDetail) => {
    const fileBirthTime = await getFileCreationDateTime(
      file,
      this.vault.adapter
    );

    const datetimePrefix = fileBirthTime.toFormat(FILENAME_DATE_FORMAT);

    const categoryRegex = generateCategoryRegex(this.settings);

    // The order here is important; do not re-order.
    const cleanFilename = file.name
      .replace(categoryRegex, "")
      .replace(CATEGORY_REGEX_LEGACY, "")
      .replace(/[\s,]/g, "-")
      .replace(/[-]{3}/gm, "-")
      .trim()
      .toLowerCase();

    return `${datetimePrefix}-${cleanFilename}`;
  };
}

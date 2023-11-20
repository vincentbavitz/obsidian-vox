import { Settings } from "settings";

export const PUBLIC_API_ENDPOINT = "https://api.obsidian-vox.org:1337";

export const FILENAME_DATE_FORMAT = "yyyyMMdd-hh:mm";
export const MARKDOWN_DATE_FORMAT = "yyyy-MM-dd hh:mm";
export const GIT_COMMMIT_DATE_FORMAT = "yyyy-MM-dd hh:mm";

export const VALID_HOST_REGEX = new RegExp(
  "^http(s)?://[a-z0-9-]*.[a-z0-9-]*.?([a-z0-9-]*)?.?([a-z0-9-]*)?:[0-9]{2,6}$",
  "gmi"
);

/**
 * The location that audio files are stored at relative
 * to the output markdown file
 **/
export const RELATIVE_AUDIO_FILE_LOCATION = "./audio";
export const CATEGORY_REGEX_LEGACY = new RegExp(/^([ABCD]{1,6})\s/);
export const FFMPEG_PATH = "./.ffmpeg/ffmpeg";
export const DATETIME_IN_FILE_REGEX =
  /\/([0-9]{4}[0-9]{2}[0-9]{2}-[0-9]{2}:[0-9]{2})/;

/**
 * Build regex for Filename categories and importance ratings.
 * For more info, see README.md.
 * @example /^(R[1-5]((LN)|(IN)|(DR)))\s/
 */
export const generateCategoryRegex = (settings: Settings) => {
  return new RegExp(
    `^(R[1-5](${Object.keys(settings.categoryMap)
      .map((k) => `(${k})`)
      .join("|")}))\\s`
  );
};

import { DateTime } from "luxon";
import { DataAdapter } from "obsidian";
import { FileDetail } from "../types";

const FILE_EXTENSION_REGEX = /\.[A-Za-z0-9]{1,6}$/;

export const extractFileDetail = (filepath: string): FileDetail => {
  const inputPathSplit = filepath.split("/");
  const filename = inputPathSplit[inputPathSplit.length - 1];

  const directory = filepath.replace(filename, "");
  const extension = filepath.match(FILE_EXTENSION_REGEX)?.[0] ?? "";
  const name = filename.replace(FILE_EXTENSION_REGEX, "");

  return {
    name,
    filename,
    extension,
    directory,
    filepath,
  };
};

/** Get the earliest timestamp from metadata */
export const getFileCreationDateTime = async (
  file: FileDetail,
  adapter: DataAdapter
) => {
  const stats = await adapter.stat(file.filepath);
  const earliestTimestamp = Math.min(
    stats?.ctime ?? Date.now(),
    stats?.mtime ?? Date.now()
  );

  return DateTime.fromMillis(Math.floor(earliestTimestamp));
};

import fs from "fs/promises";
import PQueue from "p-queue";

/**
 * Extracts the most used words from a text, and saves them to your
 * rankings corpus file.
 * This is then used to pick out tags.
 */
export class WordRank {
  public rankingMap: Record<string, number>;
  private corpusLocation: string;

  constructor() {
    this.corpusLocation = __dirname + "/../../rankings.json";
    this.rankingMap = {};
  }

  /**
   * Optionally pull in data from the corpus already saved in rankings.json
   */
  public async initFromCorpus() {
    try {
      const rankingsJSON = await fs.readFile(this.corpusLocation, {
        encoding: "utf8",
      });

      const asArray = JSON.parse(rankingsJSON);
      asArray.forEach((item: [string, number]) => {
        this.rankingMap[item[0]] = item[1];
      });
    } catch {
      this.rankingMap = {};
    }
  }

  /**
   * Update the corpus of used words for the ranking map,
   * given some additional amount of text.
   */
  public updateCorpus(text: string) {
    // Tidy up and filter out any words that contain non-alphabetic characters.
    const cleaned = text
      .toLowerCase()
      .split(" ")
      .filter((w) => !/[^a-z]/g.test(w));

    cleaned.forEach((word) => {
      if (!(word in this.rankingMap)) {
        this.rankingMap[word] = 1;
        return;
      }

      this.rankingMap[word] = this.rankingMap[word] + 1;
    });

    return this.rankingMap;
  }

  public toSorted() {
    return Object.entries(this.rankingMap).sort((a, b) => b[1] - a[1]);
  }

  // Save the work rankings to a JSON file.
  public async toFileJSON() {
    return fs.writeFile(this.corpusLocation, JSON.stringify(this.toSorted()), {
      encoding: "utf8",
    });
  }
}

/**
 * Generate a work ranking corpus; reading from a directory of files.
 * This is used to generate intelligent tags.
 */
export async function generateCorpusFromDirectories(
  directories: Array<string>
) {
  const corpusQueue = new PQueue({ concurrency: 1 });

  const ranker = new WordRank();
  await ranker.initFromCorpus();

  const filepaths: Array<string> = [];

  const processFilepath = async (filepath: string) => {
    try {
      const content = await fs.readFile(filepath, {
        encoding: "utf8",
      });

      ranker.updateCorpus(content);
    } catch (error) {
      console.warn("Invalid directory, skipping");
    }
  };

  for (const directory of directories) {
    try {
      const currentDirectoryFiles = await fs.readdir(directory);
      const currentFilepaths = currentDirectoryFiles.map(
        (file) => `${directory}/${file}`
      );

      filepaths.push(...currentFilepaths);
    } catch (error) {
      console.warn("Failed to parse directory:", error);
    }
  }

  filepaths.forEach((filepath) => {
    corpusQueue.add(() => processFilepath(filepath));
  });

  await corpusQueue.onIdle();
  return ranker;
}

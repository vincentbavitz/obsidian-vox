import { Settings } from "../settings";
import { WordRank } from "./ranking";

/**
 * Match a text against a list of tags, returning them in descending
 * order of most occurrences.
 */
export const extractTags = async (text: string, settings: Settings) => {
  const ranker = new WordRank();
  ranker.updateCorpus(text);

  // Match ranking map against our tags.
  try {
    const tags: Array<string> = settings.tags.map((tag) => tag.toLowerCase());

    const intersection = ranker
      .toSorted()
      .filter(([word]) => tags.includes(word))
      .map(([word]) => word);

    return intersection
      .slice(0, Number(settings.tagLimit ?? 10))
      .map((tag) => `#${tag}`);
  } catch (error) {
    console.warn("Error fetching tags from config", error);
    return [];
  }
};

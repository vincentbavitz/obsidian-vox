import { Settings } from "settings";
import { CATEGORY_REGEX_LEGACY, generateCategoryRegex } from "../constants";
import { VoiceMemoCategorization } from "../types";

/**
 * Extract a category based upon the convention outlined in README.md.
 */
export const categorizeVoiceMemo = (
  filename: string,
  settings: Settings
): VoiceMemoCategorization => {
  const categoryRegex = generateCategoryRegex(settings);

  const match = filename.match(categoryRegex);
  const legacyMatch = filename.match(CATEGORY_REGEX_LEGACY);

  // Attempt a legacy categorization
  if (match === null && legacyMatch) {
    return categorizeVoiceMemoLegacy(filename);
  }

  if (match) {
    const importance = Number(
      filename[1]
    ) as VoiceMemoCategorization["importance"];

    const categoryKey = filename.slice(2, 4);
    const categoryMapAny = settings.categoryMap as Record<string, string>;
    const categoryDisplay = categoryMapAny[categoryKey];

    const categoryLabel = categoryDisplay.toLowerCase().replace(/\s/g, "-");

    return {
      importance,
      category: {
        key: categoryKey,
        label: categoryLabel,
        display: categoryDisplay,
      },
    };
  }

  return {
    importance: 1,
    category: null,
  };
};

/**
 * Match legacy categories
 * @example 'AA Really big event.m4a' -> R = 5
 * @example 'BBB Something cool happened.m4a' -> R = 3
 */
const categorizeVoiceMemoLegacy = (
  filename: string
): VoiceMemoCategorization => {
  const match = filename.match(CATEGORY_REGEX_LEGACY);
  let importance: VoiceMemoCategorization["importance"] = 1;

  if (!match) {
    return {
      importance,
      category: null,
    };
  }

  // Example; AAA Really big event
  if (filename.match(/^[A]{2,8}\s/)) {
    importance = 5;
  } else if (filename.match(/^[B]{2,8}\s/)) {
    importance = 4;
  } else if (filename.match(/^[C]{2,8}\s/)) {
    importance = 3;
  } else if (filename.match(/^[D]{2,8}\s/)) {
    importance = 2;
  }

  return {
    importance,
    category: null,
  };
};

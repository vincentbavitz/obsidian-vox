import TemplaterPlugin from "main";
import { PluginSettingTab, Setting, TextComponent, getIcon } from "obsidian";
import { AudioOutputExtension } from "types";
import { FolderSuggest } from "./suggesters/FolderSuggester";

// enum TagMatchSource {
//   VAULT,
//   CUSTOM,
// }

const TAG_SETTINGS_CLASS = "st-tag-setting";
const CATEGORIZATION_SETTINGS_CLASS = "st-cate-setting";
const HIDDEN_CLASS = "st-hidden";

export interface Settings {
  backendHost: string;

  watchDirectory: string;
  outputDirectory: string;

  audioOutputExtension: AudioOutputExtension;
  shouldDeleteOriginal: boolean;

  shouldCommitChanges: boolean;
  commitMessageTemplate: string;

  /** Map filename prefixes to certain categoriess */
  shouldUseCategoryMaps: boolean;
  categoryMap: Record<string, string>;

  shouldExtractTags: boolean;
  /** Custom tags to match */
  tags: Array<string>;
  tagLimit: number;
  // tagSource: TagMatchSource;
}

export const DEFAULT_SETTINGS: Settings = {
  // shouldUseSelfHostedBackend: <-- Defaults to true for now.
  // apiKey: <-- For when paid option is available.
  backendHost: "192.168.0.32:3333",

  audioOutputExtension: AudioOutputExtension.MP3,
  outputDirectory: "Voice",
  watchDirectory: "Voice/unprocessed",
  commitMessageTemplate: "🤖 {datetime} Transcribed {amount} File(s)",

  shouldDeleteOriginal: false,
  shouldUseCategoryMaps: false,
  shouldCommitChanges: true,
  shouldExtractTags: true,

  tags: [],
  tagLimit: 5,
  // tagSource: TagMatchSource.VAULT,

  categoryMap: {
    LN: "Life Note",
    IN: "Insight",
    DR: "Dream",
    RM: "Ramble",
  },
};

export class VoxSettingTab extends PluginSettingTab {
  constructor(private plugin: TemplaterPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();

    this.addSettingsCategoryHeading("General Settings");

    this.addSelfHostLocationSetting();
    this.addWatchDirectorySetting();
    this.addTranscriptionsDirectorySetting();

    this.addAudioExtensionSetting();
    this.addDeleteOriginalFileSetting();

    // Ready for Version 2
    // this.addShouldCommitGitSetting();

    this.addTagSettings();
    this.addCategorisationSettings();
  }

  addSettingsCategoryHeading(category: string, margin = false): void {
    const headingEl = this.containerEl.createEl("h2", { text: category });

    if (margin) {
      headingEl.style.marginTop = "1.5rem";
    }
  }

  addSelfHostLocationSetting(): void {
    const description = document.createDocumentFragment();
    description.append(
      "The location of your self-hosted back-end; supports IP addresses and hostnames.",
      description.createEl("br"),
      "Please remember to inclued your protocol; ",
      description.createEl("code", { text: "https://", cls: "st-inline-code" }),
      "or",
      description.createEl("code", { text: "https://", cls: "st-inline-code" }),
      "."
    );

    new Setting(this.containerEl)
      .setName("Self Hosted Backend Location")
      .setDesc(description)
      .addText((cb) => {
        cb.setPlaceholder("http://10.0.0.1");
        cb.setValue(this.plugin.settings.backendHost);
        cb.onChange((newHost) => {
          this.plugin.settings.backendHost = newHost;
          this.plugin.saveSettings();
        });
      });
  }

  addWatchDirectorySetting(): void {
    new Setting(this.containerEl)
      .setName("Watch Location")
      .setDesc(
        "The plugin will watch this location for voice-memos to process and automatically trascribe any new audio files."
      )
      .addSearch((cb) => {
        new FolderSuggest(cb.inputEl);
        cb.setPlaceholder("Example: folder1/folder2")
          .setValue(this.plugin.settings.watchDirectory)
          .onChange((newFolder) => {
            this.plugin.settings.watchDirectory = newFolder;
            this.plugin.saveSettings();
          });
      });
  }

  addTranscriptionsDirectorySetting(): void {
    new Setting(this.containerEl)
      .setName("Transcriptions Output Location")
      .setDesc("Your completed transcriptions will be placed in this folder")
      .addSearch((cb) => {
        new FolderSuggest(cb.inputEl);
        cb.setPlaceholder("Example: folder1/folder2")
          .setValue(this.plugin.settings.outputDirectory)
          .onChange((newFolder) => {
            this.plugin.settings.outputDirectory = newFolder;
            this.plugin.saveSettings();
          });
      });
  }

  addAudioExtensionSetting(): void {
    new Setting(this.containerEl)
      .setName("Audio Output Extension")
      .setDesc(
        "Audio files linked from your output transcription will be converted to this format."
      )
      .addDropdown((cb) => {
        cb.setValue(this.plugin.settings.audioOutputExtension);
        cb.addOption(
          AudioOutputExtension.MP3,
          AudioOutputExtension.MP3.toUpperCase()
        );
        cb.addOption(
          AudioOutputExtension.WAV,
          AudioOutputExtension.WAV.toUpperCase()
        );
        cb.onChange((newExtension: AudioOutputExtension) => {
          this.plugin.settings.audioOutputExtension = newExtension;
          this.plugin.saveSettings();
        });
      });
  }

  addDeleteOriginalFileSetting(): void {
    const description = document.createDocumentFragment();
    description.append(
      "When enabled, remove the original file from the watch directory.",
      description.createEl("br"),
      "Note - the audio file will always be copied into the processed directory and linked to your markdown automatically."
    );

    new Setting(this.containerEl)
      .setName("Remove Original Audio File")
      .setDesc(description)
      .addToggle((cb) => {
        cb.setValue(this.plugin.settings.shouldDeleteOriginal);
        cb.onChange((shouldDelete) => {
          this.plugin.settings.shouldDeleteOriginal = shouldDelete;
          this.plugin.saveSettings();
        });
      });
  }

  // Ready for Version 2
  // addShouldCommitGitSetting(): void {
  //   const description = document.createDocumentFragment();
  //   description.append(
  //     "When enabled, completed transcriptions will be automatically committed to your repository.",
  //     description.createEl("br"),
  //     "This setting requires ",
  //     description.createEl("a", {
  //       href: "https://github.com/denolehov/obsidian-git",
  //       text: "obsidian-git",
  //     }),
  //     " in order to funcion."
  //   );

  //   new Setting(this.containerEl)
  //     .setName("Enable Git")
  //     .setDesc(description)
  //     .addToggle((cb) => {
  //       cb.setValue(this.plugin.settings.shouldCommitChanges);
  //       cb.onChange((shouldCommit) => {
  //         this.plugin.settings.shouldCommitChanges = shouldCommit;
  //         this.plugin.saveSettings();
  //       });
  //     });
  // }

  toggleSettingsVisibility(className: string, on: boolean) {
    const items = document.getElementsByClassName(className);

    Array.from(items).forEach((item) => {
      item[on ? "removeClass" : "addClass"](HIDDEN_CLASS);
    });
  }

  addTagSettings(): void {
    this.addSettingsCategoryHeading("Tag Extraction", true);

    new Setting(this.containerEl)
      .setName("Enable Tag Extraction")
      .setDesc(
        "Intelligently pull out tags from your transcript which match those in your vault."
      )
      .addToggle((cb) => {
        cb.setValue(this.plugin.settings.shouldExtractTags);
        cb.onChange((value) => {
          this.plugin.settings.shouldExtractTags = value;
          this.plugin.saveSettings();

          // Should we display further tag settings?
          this.toggleSettingsVisibility(TAG_SETTINGS_CLASS, value);
        });
      });

    this.addTagLimitSetting(), this.addTagsListSetting();
    this.toggleSettingsVisibility(
      TAG_SETTINGS_CLASS,
      this.plugin.settings.shouldExtractTags
    );
  }

  addTagLimitSetting(): Setting {
    return new Setting(this.containerEl)
      .setName("Tag Limit")
      .setClass(TAG_SETTINGS_CLASS)
      .setDesc("Limit the number of generated tags in the output file")
      .addText((cb) => {
        const tagAmountLimit = 100;

        cb.inputEl.setAttrs({
          type: "number",
          max: tagAmountLimit,
          min: 0,
          step: 1,
        });

        cb.setValue(this.plugin.settings.tagLimit.toString());
        cb.onChange((value) => {
          const newTagLimit = Math.ceil(Number(value));

          if (isNaN(newTagLimit)) {
            return;
          }

          if (newTagLimit < 0) {
            this.plugin.settings.tagLimit = 0;
            this.plugin.saveSettings();
            return;
          }

          if (newTagLimit > tagAmountLimit) {
            this.plugin.settings.tagLimit = tagAmountLimit;
            this.plugin.saveSettings();
            return;
          }

          this.plugin.settings.tagLimit = Number(newTagLimit);
          this.plugin.saveSettings();
        });
      });
  }

  addTagsListSetting(): Setting {
    return new Setting(this.containerEl)
      .setName("Custom Tags")
      .setClass(TAG_SETTINGS_CLASS)
      .setDesc(
        "Transcripts which include references to these tags will inclue them in the generated markdown file. Separate tags with commas."
      )
      .addTextArea((cb) => {
        cb.inputEl.style.minWidth = "4rem";
        cb.inputEl.style.maxWidth = "20rem";
        cb.inputEl.rows = 3;

        cb.setPlaceholder("#dream, #philosophy, #relationships");
        cb.setValue(this.plugin.settings.tags.join(", "));

        // Validate format before we let them save

        const hasError = false;
        if (hasError) {
          cb.inputEl.style.borderColor = "red";
        }

        cb.onChange((value) => {
          this.plugin.settings.tags = value.split(", ");

          // if ("false" == 0) {
          //   hasError = true;
          // }
        });
      });
  }

  addCategorisationSettings() {
    this.addSettingsCategoryHeading("Filename Categorisation", true);

    new Setting(this.containerEl)
      .setName("Enable Filename Categorisation")

      .setDesc(
        "Categorise your transcriptions depending on the audio's filename prefix. Please see the plugin homepage for more information."
      )
      .addToggle((cb) => {
        cb.setValue(this.plugin.settings.shouldUseCategoryMaps);
        cb.onChange((shouldEnable) => {
          this.plugin.settings.shouldUseCategoryMaps = shouldEnable;
          this.plugin.saveSettings();

          // Should we display further category map settings?
          this.toggleSettingsVisibility(
            CATEGORIZATION_SETTINGS_CLASS,
            shouldEnable
          );
        });
      });

    this.addCategoryMapExample();
    this.addCategoryMapSetting();

    this.toggleSettingsVisibility(
      CATEGORIZATION_SETTINGS_CLASS,
      this.plugin.settings.shouldUseCategoryMaps
    );
  }

  addCategoryMapExample() {
    // Add an example for the filename mapping
    const exampleContainerEl = createEl("div", {
      cls: [CATEGORIZATION_SETTINGS_CLASS, "st-cate-example"],
    });

    const exampleTextEl = exampleContainerEl.createEl("p", {
      text: "For example, when we map LN to 'Life Note', the filename",
    });

    exampleTextEl.createEl("code", {
      text: "R3LN My Day At the Zoo.mp3",
      cls: "st-inline-code",
    });

    exampleTextEl.append("would produce the following frontmatter:");

    const blockCodeEl = exampleContainerEl.createEl("div", {
      cls: "st-block-code",
    });

    blockCodeEl.createEl("code", { text: "rating: 3" });
    blockCodeEl.createEl("code", { text: "transcription_category: Life Note" });

    this.containerEl.append(exampleContainerEl);
  }

  addCategoryMapRow(categoryKey: string, categoryValue: string, index: number) {
    let rowSettingTextComponent: TextComponent | undefined;

    const editButtonID = `st-cate-row-edit-${index}`;
    const checkButtonID = `st-cate-check-edit-${index}`;
    const crossButtonID = `st-cate-cross-edit-${index}`;
    const trashButtonID = `st-cate-trash-edit-${index}`;

    const enterEditingMode = () => {
      // Enter editing mode for the row
      document.getElementById(editButtonID)?.addClass(HIDDEN_CLASS);
      document.getElementById(trashButtonID)?.addClass(HIDDEN_CLASS);
      document.getElementById(checkButtonID)?.removeClass(HIDDEN_CLASS);
      document.getElementById(crossButtonID)?.removeClass(HIDDEN_CLASS);

      if (rowSettingTextComponent) {
        rowSettingTextComponent.inputEl.style.pointerEvents = "unset";
        rowSettingTextComponent.setDisabled(false);
        rowSettingTextComponent.inputEl.focus();
      }
    };

    const exitEditingMode = () => {
      document.getElementById(checkButtonID)?.addClass(HIDDEN_CLASS);
      document.getElementById(crossButtonID)?.addClass(HIDDEN_CLASS);
      document.getElementById(editButtonID)?.removeClass(HIDDEN_CLASS);
      document.getElementById(trashButtonID)?.removeClass(HIDDEN_CLASS);

      if (rowSettingTextComponent) {
        rowSettingTextComponent.inputEl.style.pointerEvents = "none";
        rowSettingTextComponent.setDisabled(true);
      }
    };

    const rowSetting = new Setting(this.containerEl)
      .setClass(CATEGORIZATION_SETTINGS_CLASS)
      .addText((cb) => {
        rowSettingTextComponent = cb;
        cb.setValue(categoryValue);
        cb.setDisabled(true);
        cb.inputEl.style.pointerEvents = "none";

        cb.onChange((value) => {
          if (value !== categoryValue) {
            null;
          }
        });
      });

    // Clicking on thie EDIT icon enters editing mode
    rowSetting.addExtraButton((cb) => {
      cb.extraSettingsEl.addClass("st-cate-row-check");
      cb.extraSettingsEl.id = editButtonID;
      cb.setIcon("edit");
      cb.onClick(enterEditingMode);
    });

    // Clicking on this CHECK icon confirms the edit.
    rowSetting.addExtraButton((cb) => {
      cb.extraSettingsEl.addClasses([HIDDEN_CLASS, "st-cate-row-check"]);
      cb.extraSettingsEl.id = checkButtonID;
      cb.setIcon("check");

      cb.onClick(() => {
        const value = rowSettingTextComponent?.inputEl.value;
        if (value?.length && value !== categoryValue) {
          this.plugin.settings.categoryMap[categoryKey] = value;
          this.plugin.saveSettings();
        }

        exitEditingMode();
      });
    });

    // Clicking on this CROSS icon cancels the edit.
    rowSetting.addExtraButton((cb) => {
      cb.extraSettingsEl.addClasses([HIDDEN_CLASS, "st-cate-row-check"]);
      cb.extraSettingsEl.id = crossButtonID;
      cb.setIcon("cross");

      cb.onClick(() => {
        if (rowSettingTextComponent) {
          const originalValue = this.plugin.settings.categoryMap[categoryKey];
          rowSettingTextComponent.inputEl.value = originalValue;
          exitEditingMode();
        }
      });
    });

    // Clicking on this TRASH icon removes the row
    rowSetting.addExtraButton((cb) => {
      cb.extraSettingsEl.addClass("st-cate-row-check");
      cb.extraSettingsEl.id = trashButtonID;

      cb.setIcon("trash");
      cb.onClick(() => {
        delete this.plugin.settings.categoryMap[categoryKey];
        this.plugin.saveSettings();
        this.display();
      });
    });

    if (index > 0) {
      rowSetting.settingEl.style.borderTop = "unset";
    }

    const keyElement = createEl("span", { text: categoryKey });
    const arrowIcon = getIcon("right-chevron-glyph");
    keyElement.style.fontFamily = "monospace";
    if (arrowIcon) {
      rowSetting.controlEl.prepend(keyElement, arrowIcon);
    }
  }

  addCategoryMapSetting(): void {
    Object.entries(this.plugin.settings.categoryMap).forEach((entry, index) => {
      this.addCategoryMapRow(entry[0], entry[1], index);
    });

    let newMapItemInputKey: HTMLInputElement | undefined;
    let newMapItemInputValue: HTMLInputElement | undefined;

    const categoryMapSetting = new Setting(this.containerEl)
      .setClass(CATEGORIZATION_SETTINGS_CLASS)
      .addText((cb) => {
        newMapItemInputKey = cb.inputEl;

        cb.inputEl.style.maxWidth = "8rem";
        cb.setPlaceholder("Filename Prefix");
        cb.inputEl.type = "text";
      })
      .addText((cb) => {
        newMapItemInputValue = cb.inputEl;
        cb.setPlaceholder("Frontmatter Value");
      })
      .addButton((cb) => {
        cb.setButtonText("Add");
        cb.setCta();
        cb.buttonEl.style.minWidth = "61px";

        cb.onClick(() => {
          if (newMapItemInputKey && newMapItemInputValue) {
            this.plugin.settings.categoryMap[newMapItemInputKey.value] =
              newMapItemInputValue.value;

            newMapItemInputKey.value = "";
            newMapItemInputValue.value = "";
            this.plugin.saveSettings();
            this.display();
          }
        });
      });

    categoryMapSetting.settingEl.style.borderTop = "unset";
    categoryMapSetting.infoEl.remove();
    categoryMapSetting.descEl.remove();
    categoryMapSetting.nameEl.remove();

    const arrowIcon = getIcon("right-chevron-glyph");

    if (arrowIcon) {
      categoryMapSetting.controlEl.insertBefore(
        arrowIcon,
        categoryMapSetting.controlEl.children[1]
      );
    }

    categoryMapSetting.infoEl.remove();
  }

  // addTagOriginSetting(): void {
  //   new Setting(this.containerEl)
  //     .setName("Reference Tags From")
  //     .setDesc(
  //       "This tells the plugin which tag set you want to use when extracting them from your transcript. By default, add of your vault's tags will be used."
  //     )

  //     .addDropdown((cb) => {
  //       cb.addOption("vault", "Vault (Automatic)");
  //       cb.addOption("custom", "Custom");
  //       cb.setValue(this.plugin.settings.tagSource)
  //     });
  // }

  //   add_template_folder_setting(): void {
  //     new Setting(this.containerEl)
  //       .setName("Template folder location")
  //       .setDesc("Files in this folder will be available as templates.")
  //       .addSearch((cb) => {
  //         new FolderSuggest(cb.inputEl);
  //         cb.setPlaceholder("Example: folder1/folder2")
  //           .setValue(this.plugin.settings.templates_folder)
  //           .onChange((new_folder) => {
  //             this.plugin.settings.templates_folder = new_folder;
  //             this.plugin.saveSettings();
  //           });
  //         // @ts-ignore
  //         cb.containerEl.addClass("templater_search");
  //       });
  //   }

  //   add_internal_functions_setting(): void {
  //     const desc = document.createDocumentFragment();
  //     desc.append(
  //       "Templater provides multiples predefined variables / functions that you can use.",
  //       desc.createEl("br"),
  //       "Check the ",
  //       desc.createEl("a", {
  //         href: "https://silentvoid13.github.io/Templater/",
  //         text: "documentation",
  //       }),
  //       " to get a list of all the available internal variables / functions."
  //     );

  //     new Setting(this.containerEl)
  //       .setName("Internal Variables and Functions")
  //       .setDesc(desc);
  //   }

  //   add_syntax_highlighting_settings(): void {
  //     const desktopDesc = document.createDocumentFragment();
  //     desktopDesc.append(
  //       "Adds syntax highlighting for Templater commands in edit mode."
  //     );

  //     const mobileDesc = document.createDocumentFragment();
  //     mobileDesc.append(
  //       "Adds syntax highlighting for Templater commands in edit mode on " +
  //         "mobile. Use with caution: this may break live preview on mobile " +
  //         "platforms."
  //     );

  //     new Setting(this.containerEl)
  //       .setName("Syntax Highlighting on Desktop")
  //       .setDesc(desktopDesc)
  //       .addToggle((toggle) => {
  //         toggle
  //           .setValue(this.plugin.settings.syntax_highlighting)
  //           .onChange((syntax_highlighting) => {
  //             this.plugin.settings.syntax_highlighting = syntax_highlighting;
  //             this.plugin.saveSettings();
  //             this.plugin.event_handler.update_syntax_highlighting();
  //           });
  //       });

  //     new Setting(this.containerEl)
  //       .setName("Syntax Highlighting on Mobile")
  //       .setDesc(mobileDesc)
  //       .addToggle((toggle) => {
  //         toggle
  //           .setValue(this.plugin.settings.syntax_highlighting_mobile)
  //           .onChange((syntax_highlighting_mobile) => {
  //             this.plugin.settings.syntax_highlighting_mobile =
  //               syntax_highlighting_mobile;
  //             this.plugin.saveSettings();
  //             this.plugin.event_handler.update_syntax_highlighting();
  //           });
  //       });
  //   }

  //   add_auto_jump_to_cursor(): void {
  //     const desc = document.createDocumentFragment();
  //     desc.append(
  //       "Automatically triggers ",
  //       desc.createEl("code", { text: "tp.file.cursor" }),
  //       " after inserting a template.",
  //       desc.createEl("br"),
  //       "You can also set a hotkey to manually trigger ",
  //       desc.createEl("code", { text: "tp.file.cursor" }),
  //       "."
  //     );

  //     new Setting(this.containerEl)
  //       .setName("Automatic jump to cursor")
  //       .setDesc(desc)
  //       .addToggle((toggle) => {
  //         toggle
  //           .setValue(this.plugin.settings.auto_jump_to_cursor)
  //           .onChange((auto_jump_to_cursor) => {
  //             this.plugin.settings.auto_jump_to_cursor = auto_jump_to_cursor;
  //             this.plugin.saveSettings();
  //           });
  //       });
  //   }

  //   add_trigger_on_new_file_creation_setting(): void {
  //     const desc = document.createDocumentFragment();
  //     desc.append(
  //       "Templater will listen for the new file creation event, and replace every command it finds in the new file's content.",
  //       desc.createEl("br"),
  //       "This makes Templater compatible with other plugins like the Daily note core plugin, Calendar plugin, Review plugin, Note refactor plugin, ...",
  //       desc.createEl("br"),
  //       desc.createEl("b", {
  //         text: "Warning: ",
  //       }),
  //       "This can be dangerous if you create new files with unknown / unsafe content on creation. Make sure that every new file's content is safe on creation."
  //     );

  //     new Setting(this.containerEl)
  //       .setName("Trigger Templater on new file creation")
  //       .setDesc(desc)
  //       .addToggle((toggle) => {
  //         toggle
  //           .setValue(this.plugin.settings.trigger_on_file_creation)
  //           .onChange((trigger_on_file_creation) => {
  //             this.plugin.settings.trigger_on_file_creation =
  //               trigger_on_file_creation;
  //             this.plugin.saveSettings();
  //             this.plugin.event_handler.update_trigger_file_on_creation();
  //             // Force refresh
  //             this.display();
  //           });
  //       });
  //   }

  //   add_ribbon_icon_setting(): void {
  //     const desc = document.createDocumentFragment();
  //     desc.append(
  //       "Show Templater icon in sidebar ribbon, allowing you to quickly use templates anywhere."
  //     );

  //     new Setting(this.containerEl)
  //       .setName("Show icon in sidebar")
  //       .setDesc(desc)
  //       .addToggle((toggle) => {
  //         toggle
  //           .setValue(this.plugin.settings.enable_ribbon_icon)
  //           .onChange((enable_ribbon_icon) => {
  //             this.plugin.settings.enable_ribbon_icon = enable_ribbon_icon;
  //             this.plugin.saveSettings();
  //             if (this.plugin.settings.enable_ribbon_icon) {
  //               this.plugin
  //                 .addRibbonIcon("templater-icon", "Templater", async () => {
  //                   this.plugin.fuzzy_suggester.insert_template();
  //                 })
  //                 .setAttribute("id", "rb-templater-icon");
  //             } else {
  //               document.getElementById("rb-templater-icon")?.remove();
  //             }
  //           });
  //       });
  //   }

  //   add_templates_hotkeys_setting(): void {
  //     this.containerEl.createEl("h2", { text: "Template Hotkeys" });

  //     const desc = document.createDocumentFragment();
  //     desc.append("Template Hotkeys allows you to bind a template to a hotkey.");

  //     new Setting(this.containerEl).setDesc(desc);

  //     this.plugin.settings.enabled_templates_hotkeys.forEach(
  //       (template, index) => {
  //         const s = new Setting(this.containerEl)
  //           .addSearch((cb) => {
  //             new FileSuggest(
  //               cb.inputEl,
  //               this.plugin,
  //               FileSuggestMode.TemplateFiles
  //             );
  //             cb.setPlaceholder("Example: folder1/template_file")
  //               .setValue(template)
  //               .onChange((new_template) => {
  //                 if (
  //                   new_template &&
  //                   this.plugin.settings.enabled_templates_hotkeys.contains(
  //                     new_template
  //                   )
  //                 ) {
  //                   log_error(
  //                     new TemplaterError(
  //                       "This template is already bound to a hotkey"
  //                     )
  //                   );
  //                   return;
  //                 }
  //                 this.plugin.command_handler.add_template_hotkey(
  //                   this.plugin.settings.enabled_templates_hotkeys[index],
  //                   new_template
  //                 );
  //                 this.plugin.settings.enabled_templates_hotkeys[index] =
  //                   new_template;
  //                 this.plugin.saveSettings();
  //               });
  //             // @ts-ignore
  //             cb.containerEl.addClass("templater_search");
  //           })
  //           .addExtraButton((cb) => {
  //             cb.setIcon("any-key")
  //               .setTooltip("Configure Hotkey")
  //               .onClick(() => {
  //                 // TODO: Replace with future "official" way to do this
  //                 // @ts-ignore
  //                 app.setting.openTabById("hotkeys");
  //                 // @ts-ignore
  //                 const tab = app.setting.activeTab;
  //                 tab.searchInputEl.value = "Templater: Insert";
  //                 tab.updateHotkeyVisibility();
  //               });
  //           })
  //           .addExtraButton((cb) => {
  //             cb.setIcon("up-chevron-glyph")
  //               .setTooltip("Move up")
  //               .onClick(() => {
  //                 arraymove(
  //                   this.plugin.settings.enabled_templates_hotkeys,
  //                   index,
  //                   index - 1
  //                 );
  //                 this.plugin.saveSettings();
  //                 this.display();
  //               });
  //           })
  //           .addExtraButton((cb) => {
  //             cb.setIcon("down-chevron-glyph")
  //               .setTooltip("Move down")
  //               .onClick(() => {
  //                 arraymove(
  //                   this.plugin.settings.enabled_templates_hotkeys,
  //                   index,
  //                   index + 1
  //                 );
  //                 this.plugin.saveSettings();
  //                 this.display();
  //               });
  //           })
  //           .addExtraButton((cb) => {
  //             cb.setIcon("cross")
  //               .setTooltip("Delete")
  //               .onClick(() => {
  //                 this.plugin.command_handler.remove_template_hotkey(
  //                   this.plugin.settings.enabled_templates_hotkeys[index]
  //                 );
  //                 this.plugin.settings.enabled_templates_hotkeys.splice(index, 1);
  //                 this.plugin.saveSettings();
  //                 // Force refresh
  //                 this.display();
  //               });
  //           });
  //         s.infoEl.remove();
  //       }
  //     );

  //     new Setting(this.containerEl).addButton((cb) => {
  //       cb.setButtonText("Add new hotkey for template")
  //         .setCta()
  //         .onClick(() => {
  //           this.plugin.settings.enabled_templates_hotkeys.push("");
  //           this.plugin.saveSettings();
  //           // Force refresh
  //           this.display();
  //         });
  //     });
  //   }

  //   add_folder_templates_setting(): void {
  //     this.containerEl.createEl("h2", { text: "Folder Templates" });

  //     const descHeading = document.createDocumentFragment();
  //     descHeading.append(
  //       "Folder Templates are triggered when a new ",
  //       descHeading.createEl("strong", { text: "empty " }),
  //       "file is created in a given folder.",
  //       descHeading.createEl("br"),
  //       "Templater will fill the empty file with the specified template.",
  //       descHeading.createEl("br"),
  //       "The deepest match is used. A global default template would be defined on the root ",
  //       descHeading.createEl("code", { text: "/" }),
  //       "."
  //     );

  //     new Setting(this.containerEl).setDesc(descHeading);

  //     const descUseNewFileTemplate = document.createDocumentFragment();
  //     descUseNewFileTemplate.append(
  //       "When enabled Templater will make use of the folder templates defined below."
  //     );

  //     new Setting(this.containerEl)
  //       .setName("Enable Folder Templates")
  //       .setDesc(descUseNewFileTemplate)
  //       .addToggle((toggle) => {
  //         toggle
  //           .setValue(this.plugin.settings.enable_folder_templates)
  //           .onChange((use_new_file_templates) => {
  //             this.plugin.settings.enable_folder_templates =
  //               use_new_file_templates;
  //             this.plugin.saveSettings();
  //             // Force refresh
  //             this.display();
  //           });
  //       });

  //     if (!this.plugin.settings.enable_folder_templates) {
  //       return;
  //     }

  //     new Setting(this.containerEl)
  //       .setName("Add New")
  //       .setDesc("Add new folder template")
  //       .addButton((button: ButtonComponent) => {
  //         button
  //           .setTooltip("Add additional folder template")
  //           .setButtonText("+")
  //           .setCta()
  //           .onClick(() => {
  //             this.plugin.settings.folder_templates.push({
  //               folder: "",
  //               template: "",
  //             });
  //             this.plugin.saveSettings();
  //             this.display();
  //           });
  //       });

  //     this.plugin.settings.folder_templates.forEach((folder_template, index) => {
  //       const s = new Setting(this.containerEl)
  //         .addSearch((cb) => {
  //           new FolderSuggest(cb.inputEl);
  //           cb.setPlaceholder("Folder")
  //             .setValue(folder_template.folder)
  //             .onChange((new_folder) => {
  //               if (
  //                 new_folder &&
  //                 this.plugin.settings.folder_templates.some(
  //                   (e) => e.folder == new_folder
  //                 )
  //               ) {
  //                 log_error(
  //                   new TemplaterError(
  //                     "This folder already has a template associated with it"
  //                   )
  //                 );
  //                 return;
  //               }

  //               this.plugin.settings.folder_templates[index].folder = new_folder;
  //               this.plugin.saveSettings();
  //             });
  //           // @ts-ignore
  //           cb.containerEl.addClass("templater_search");
  //         })
  //         .addSearch((cb) => {
  //           new FileSuggest(
  //             cb.inputEl,
  //             this.plugin,
  //             FileSuggestMode.TemplateFiles
  //           );
  //           cb.setPlaceholder("Template")
  //             .setValue(folder_template.template)
  //             .onChange((new_template) => {
  //               this.plugin.settings.folder_templates[index].template =
  //                 new_template;
  //               this.plugin.saveSettings();
  //             });
  //           // @ts-ignore
  //           cb.containerEl.addClass("templater_search");
  //         })
  //         .addExtraButton((cb) => {
  //           cb.setIcon("up-chevron-glyph")
  //             .setTooltip("Move up")
  //             .onClick(() => {
  //               arraymove(
  //                 this.plugin.settings.folder_templates,
  //                 index,
  //                 index - 1
  //               );
  //               this.plugin.saveSettings();
  //               this.display();
  //             });
  //         })
  //         .addExtraButton((cb) => {
  //           cb.setIcon("down-chevron-glyph")
  //             .setTooltip("Move down")
  //             .onClick(() => {
  //               arraymove(
  //                 this.plugin.settings.folder_templates,
  //                 index,
  //                 index + 1
  //               );
  //               this.plugin.saveSettings();
  //               this.display();
  //             });
  //         })
  //         .addExtraButton((cb) => {
  //           cb.setIcon("cross")
  //             .setTooltip("Delete")
  //             .onClick(() => {
  //               this.plugin.settings.folder_templates.splice(index, 1);
  //               this.plugin.saveSettings();
  //               this.display();
  //             });
  //         });
  //       s.infoEl.remove();
  //     });
  //   }

  //   add_startup_templates_setting(): void {
  //     this.containerEl.createEl("h2", { text: "Startup Templates" });

  //     const desc = document.createDocumentFragment();
  //     desc.append(
  //       "Startup Templates are templates that will get executed once when Templater starts.",
  //       desc.createEl("br"),
  //       "These templates won't output anything.",
  //       desc.createEl("br"),
  //       "This can be useful to set up templates adding hooks to obsidian events for example."
  //     );

  //     new Setting(this.containerEl).setDesc(desc);

  //     this.plugin.settings.startup_templates.forEach((template, index) => {
  //       const s = new Setting(this.containerEl)
  //         .addSearch((cb) => {
  //           new FileSuggest(
  //             cb.inputEl,
  //             this.plugin,
  //             FileSuggestMode.TemplateFiles
  //           );
  //           cb.setPlaceholder("Example: folder1/template_file")
  //             .setValue(template)
  //             .onChange((new_template) => {
  //               if (
  //                 new_template &&
  //                 this.plugin.settings.startup_templates.contains(new_template)
  //               ) {
  //                 log_error(
  //                   new TemplaterError("This startup template already exist")
  //                 );
  //                 return;
  //               }
  //               this.plugin.settings.startup_templates[index] = new_template;
  //               this.plugin.saveSettings();
  //             });
  //           // @ts-ignore
  //           cb.containerEl.addClass("templater_search");
  //         })
  //         .addExtraButton((cb) => {
  //           cb.setIcon("cross")
  //             .setTooltip("Delete")
  //             .onClick(() => {
  //               this.plugin.settings.startup_templates.splice(index, 1);
  //               this.plugin.saveSettings();
  //               // Force refresh
  //               this.display();
  //             });
  //         });
  //       s.infoEl.remove();
  //     });

  //     new Setting(this.containerEl).addButton((cb) => {
  //       cb.setButtonText("Add new startup template")
  //         .setCta()
  //         .onClick(() => {
  //           this.plugin.settings.startup_templates.push("");
  //           this.plugin.saveSettings();
  //           // Force refresh
  //           this.display();
  //         });
  //     });
  //   }

  //   add_user_system_command_functions_setting(): void {
  //     let desc = document.createDocumentFragment();
  //     desc.append(
  //       "Allows you to create user functions linked to system commands.",
  //       desc.createEl("br"),
  //       desc.createEl("b", {
  //         text: "Warning: ",
  //       }),
  //       "It can be dangerous to execute arbitrary system commands from untrusted sources. Only run system commands that you understand, from trusted sources."
  //     );

  //     this.containerEl.createEl("h2", {
  //       text: "User System Command Functions",
  //     });

  //     new Setting(this.containerEl)
  //       .setName("Enable User System Command Functions")
  //       .setDesc(desc)
  //       .addToggle((toggle) => {
  //         toggle
  //           .setValue(this.plugin.settings.enable_system_commands)
  //           .onChange((enable_system_commands) => {
  //             this.plugin.settings.enable_system_commands =
  //               enable_system_commands;
  //             this.plugin.saveSettings();
  //             // Force refresh
  //             this.display();
  //           });
  //       });

  //     if (this.plugin.settings.enable_system_commands) {
  //       new Setting(this.containerEl)
  //         .setName("Timeout")
  //         .setDesc("Maximum timeout in seconds for a system command.")
  //         .addText((text) => {
  //           text
  //             .setPlaceholder("Timeout")
  //             .setValue(this.plugin.settings.command_timeout.toString())
  //             .onChange((new_value) => {
  //               const new_timeout = Number(new_value);
  //               if (isNaN(new_timeout)) {
  //                 log_error(new TemplaterError("Timeout must be a number"));
  //                 return;
  //               }
  //               this.plugin.settings.command_timeout = new_timeout;
  //               this.plugin.saveSettings();
  //             });
  //         });

  //       desc = document.createDocumentFragment();
  //       desc.append(
  //         "Full path to the shell binary to execute the command with.",
  //         desc.createEl("br"),
  //         "This setting is optional and will default to the system's default shell if not specified.",
  //         desc.createEl("br"),
  //         "You can use forward slashes ('/') as path separators on all platforms if in doubt."
  //       );
  //       new Setting(this.containerEl)
  //         .setName("Shell binary location")
  //         .setDesc(desc)
  //         .addText((text) => {
  //           text
  //             .setPlaceholder("Example: /bin/bash, ...")
  //             .setValue(this.plugin.settings.shell_path)
  //             .onChange((shell_path) => {
  //               this.plugin.settings.shell_path = shell_path;
  //               this.plugin.saveSettings();
  //             });
  //         });

  //       let i = 1;
  //       this.plugin.settings.templates_pairs.forEach((template_pair) => {
  //         const div = this.containerEl.createEl("div");
  //         div.addClass("templater_div");

  //         const title = this.containerEl.createEl("h4", {
  //           text: "User Function n°" + i,
  //         });
  //         title.addClass("templater_title");

  //         const setting = new Setting(this.containerEl)
  //           .addExtraButton((extra) => {
  //             extra
  //               .setIcon("cross")
  //               .setTooltip("Delete")
  //               .onClick(() => {
  //                 const index =
  //                   this.plugin.settings.templates_pairs.indexOf(template_pair);
  //                 if (index > -1) {
  //                   this.plugin.settings.templates_pairs.splice(index, 1);
  //                   this.plugin.saveSettings();
  //                   // Force refresh
  //                   this.display();
  //                 }
  //               });
  //           })
  //           .addText((text) => {
  //             const t = text
  //               .setPlaceholder("Function name")
  //               .setValue(template_pair[0])
  //               .onChange((new_value) => {
  //                 const index =
  //                   this.plugin.settings.templates_pairs.indexOf(template_pair);
  //                 if (index > -1) {
  //                   this.plugin.settings.templates_pairs[index][0] = new_value;
  //                   this.plugin.saveSettings();
  //                 }
  //               });
  //             t.inputEl.addClass("templater_template");

  //             return t;
  //           })
  //           .addTextArea((text) => {
  //             const t = text
  //               .setPlaceholder("System Command")
  //               .setValue(template_pair[1])
  //               .onChange((new_cmd) => {
  //                 const index =
  //                   this.plugin.settings.templates_pairs.indexOf(template_pair);
  //                 if (index > -1) {
  //                   this.plugin.settings.templates_pairs[index][1] = new_cmd;
  //                   this.plugin.saveSettings();
  //                 }
  //               });

  //             t.inputEl.setAttr("rows", 2);
  //             t.inputEl.addClass("templater_cmd");

  //             return t;
  //           });

  //         setting.infoEl.remove();

  //         div.appendChild(title);
  //         div.appendChild(this.containerEl.lastChild as Node);

  //         i += 1;
  //       });

  //       const div = this.containerEl.createEl("div");
  //       div.addClass("templater_div2");

  //       const setting = new Setting(this.containerEl).addButton((button) => {
  //         button
  //           .setButtonText("Add New User Function")
  //           .setCta()
  //           .onClick(() => {
  //             this.plugin.settings.templates_pairs.push(["", ""]);
  //             this.plugin.saveSettings();
  //             // Force refresh
  //             this.display();
  //           });
  //       });
  //       setting.infoEl.remove();

  //       div.appendChild(this.containerEl.lastChild as Node);
  //     }
  //   }
}

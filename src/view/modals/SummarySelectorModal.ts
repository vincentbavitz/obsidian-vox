import { App, Modal, Setting } from "obsidian";
import { PeriodInfo } from "SummarizationScheduler";

export class ConfirmModal extends Modal {
  constructor(app: App, private message: string, private onConfirm: () => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Cancel")
          .onClick(() => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText("Confirm")
          .setCta()
          .onClick(() => {
            this.onConfirm();
            this.close();
          })
      );
  }
}

export class SummarySelectorModal extends Modal {
  constructor(
    app: App,
    private periods: PeriodInfo[],
    private onGenerate: (id: string) => void,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Generate Summary" });

    if (this.periods.length === 0) {
      contentEl.createEl("p", { text: "No periods available." });
      return;
    }

    for (const period of this.periods) {
      const container = contentEl.createDiv({
        cls: "summary-period-item",
        attr: {
          style: `padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid var(--divider-color); border-radius: 4px;`,
        },
      });

      const disabled = !period.isReady;
      const opacity = disabled ? "0.5" : "1";

      container.style.opacity = opacity;
      container.style.cursor = disabled ? "not-allowed" : "pointer";

      const titleEl = container.createEl("div", {
        text: `${period.label} (${period.noteCount || period.summaryCount} items)`,
        attr: {
          style: `font-weight: 500; margin-bottom: 0.25rem;`,
        },
      });

      if (period.summaryExists) {
        const existsEl = container.createEl("small", {
          text: "Summary already exists",
          attr: {
            style: `color: var(--color-yellow); display: block; margin-bottom: 0.25rem;`,
          },
        });
      }

      if (period.readinessReason) {
        const reasonEl = container.createEl("small", {
          text: period.readinessReason,
          attr: {
            style: `color: var(--text-faint); display: block;`,
          },
        });
      }

      if (!disabled) {
        container.addEventListener("click", async () => {
          if (period.summaryExists) {
            // Show confirmation dialog
            new ConfirmModal(
              this.app,
              `This will overwrite the existing summary for "${period.label}". Continue?`,
              () => {
                this.onGenerate(period.id);
                this.close();
              },
            ).open();
          } else {
            this.onGenerate(period.id);
            this.close();
          }
        });
      }
    }
  }
}

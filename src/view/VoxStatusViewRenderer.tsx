import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { Root, createRoot } from "react-dom/client";
import { TranscriptionProcessor, TranscriptionProcessorState } from "TranscriptionProcessor";
import { SummarizationScheduler, SummarizationSchedulerState } from "SummarizationScheduler";
import { AppContext } from "./AppContext";
import { VoxStatus } from "./VoxStatusView";

export const VOX_STATUS_VIEW = "vox-status-view";

// We import as React rather than { StrictMode } so that we implicitly import the
// React dependency, since we need it during the build step.
// See the following for context: https://github.com/microsoft/TypeScript/issues/49486
export class VoxStatusViewRenderer extends ItemView {
  processorState: TranscriptionProcessorState;
  schedulerState: SummarizationSchedulerState;
  root: Root | null = null;
  private unsubscribeProcessor: () => void;
  private unsubscribeScheduler: () => void;

  constructor(readonly leaf: WorkspaceLeaf, private processor: TranscriptionProcessor, private scheduler: SummarizationScheduler) {
    super(leaf);

    this.processorState = this.processor.state;
    this.schedulerState = this.scheduler.state;

    // Tell our processors to re-render the status view when the status changes.
    this.unsubscribeProcessor = this.processor.subscribe((state) => {
      this.processorState = state;
      this.render();
    });

    this.unsubscribeScheduler = this.scheduler.subscribe((state) => {
      this.schedulerState = state;
      this.render();
    });
  }

  getViewType() {
    return VOX_STATUS_VIEW;
  }

  getDisplayText() {
    return "VOX Status";
  }

  getIcon(): string {
    return "file-audio";
  }

  async onOpen() {
    this.root = createRoot(this.containerEl.children[1]);
    this.render();
  }

  render() {
    if (!this.root) {
      return null;
    }

    this.root.render(
      <React.StrictMode>
        <AppContext.Provider value={this.app}>
          <VoxStatus
            leaf={this.leaf}
            processorState={this.processorState}
            schedulerState={this.schedulerState}
            onClickResume={() => this.processor.resume()}
            onClickPause={() => this.processor.pause()}
          />
        </AppContext.Provider>
      </React.StrictMode>
    );
  }

  async onClose() {
    this.root?.unmount();
    this.unsubscribeProcessor();
    this.unsubscribeScheduler();
  }
}

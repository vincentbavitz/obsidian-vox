import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { Root, createRoot } from "react-dom/client";
import { TranscriptionProcessor, TranscriptionProcessorState } from "TranscriptionProcessor";
import { AppContext } from "./AppContext";
import { VoxStatus } from "./VoxStatusView";

export const VOX_STATUS_VIEW = "vox-status-view";

// We import as React rather than { StrictMode } so that we implicitly import the
// React dependency, since we need it during the build step.
// See the following for context: https://github.com/microsoft/TypeScript/issues/49486
export class VoxStatusViewRenderer extends ItemView {
  state: TranscriptionProcessorState;
  root: Root | null = null;
  private unsubscribe: () => void;

  constructor(readonly leaf: WorkspaceLeaf, private processor: TranscriptionProcessor) {
    super(leaf);

    this.state = this.processor.state;

    // Tell our processor to re-render the status view when the status changes.
    this.unsubscribe = this.processor.subscribe((state) => {
      this.state = state;
      this.render(state);
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
    this.render(this.state);
  }

  render(state: TranscriptionProcessorState) {
    if (!this.root) {
      return null;
    }

    this.root.render(
      <React.StrictMode>
        <AppContext.Provider value={this.app}>
          <VoxStatus
            leaf={this.leaf}
            state={state}
            onClickResume={() => this.processor.resume()}
            onClickPause={() => this.processor.pause()}
          />
        </AppContext.Provider>
      </React.StrictMode>
    );
  }

  async onClose() {
    this.root?.unmount();
    this.unsubscribe();
  }
}

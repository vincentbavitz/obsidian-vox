import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { Root, createRoot } from "react-dom/client";
import { TranscriptionProcessor } from "TranscriptionProcessor";
import { VoxStatusMap } from "types";
import { AppContext } from "./AppContext";
import { VoxStatus } from "./VoxStatus";

export const VOX_STATUS_VIEW = "vox-status-view";

// We import as React rather than { StrictMode } so that we implicitly import the
// React dependency, since we need it during the build step.
// See the following for context: https://github.com/microsoft/TypeScript/issues/49486

export class VoxStatusView extends ItemView {
  status: VoxStatusMap;
  root: Root | null = null;

  constructor(readonly leaf: WorkspaceLeaf, private processor: TranscriptionProcessor) {
    super(leaf);

    this.status = this.processor.status;

    // Tell our processor to re-render the status view when the status changes.
    this.processor.onStatusChange = (status) => {
      this.status = status;
      this.render(status);
    };
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
    this.render(this.status);
  }

  render(status: VoxStatusMap) {
    if (!this.root) {
      return null;
    }

    this.root.render(
      <React.StrictMode>
        <AppContext.Provider value={this.app}>
          <VoxStatus leaf={this.leaf} status={status} />
        </AppContext.Provider>
      </React.StrictMode>
    );
  }

  async onClose() {
    this.root?.unmount();
  }
}

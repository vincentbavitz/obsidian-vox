import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { Root, createRoot } from "react-dom/client";
import { VoxStatusMap } from "types";
import { AppContext } from "./AppContext";
import { VoxStatus } from "./VoxStatus";

export const VOX_STATUS_VIEW = "vox-status-view";

// We import as React rather than { StrictMode } so that we implicitly import the
// React dependency, since we need it during the build step.
// See the following for context: https://github.com/microsoft/TypeScript/issues/49486

export class VoxStatusView extends ItemView {
  root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, private status: VoxStatusMap) {
    super(leaf);
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
    const state = this.leaf.getEphemeralState();
    console.log("StatusView ➡️ state:", state);

    console.log("StatusView ➡️ this.root:", this.root);

    this.root.render(
      <React.StrictMode>
        <AppContext.Provider value={this.app}>
          <VoxStatus status={this.status} />
        </AppContext.Provider>
      </React.StrictMode>
    );
  }

  async onClose() {
    this.root?.unmount();
  }
}

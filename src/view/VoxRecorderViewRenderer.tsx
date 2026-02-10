import AudioRecorder, { AudioRecorderState } from "AudioRecorder";
import VoxPlugin from "main";
import { ItemView, WorkspaceLeaf } from "obsidian";
import React from "react";
import { Root, createRoot } from "react-dom/client";
import { TranscriptionProcessor, TranscriptionProcessorState } from "TranscriptionProcessor";
import VoxPanelRecorder from "./components/VoxPanelRecorder";

export const VOX_RECORDER_VIEW = "vox-recorder-view";

type ViewState = {
  processor: TranscriptionProcessorState;
  recorder: AudioRecorderState;
};

// We import as React rather than { StrictMode } so that we implicitly import the
// React dependency, since we need it during the build step.
// See the following for context: https://github.com/microsoft/TypeScript/issues/49486
export class VoxRecorderViewRenderer extends ItemView {
  state: ViewState;
  root: Root | null = null;

  private unsubscribeProcessor: () => void;
  private unsubscribeRecorder: () => void;

  constructor(
    readonly leaf: WorkspaceLeaf,
    private processor: TranscriptionProcessor,
    private recorder: AudioRecorder,
    private plugin: VoxPlugin,
  ) {
    super(leaf);

    this.state = {
      processor: this.processor.state,
      recorder: this.recorder.state,
    };

    // Tell our processor to re-render the status view when the status changes.
    this.unsubscribeProcessor = this.processor.subscribe((state) => {
      this.state.processor = state;
      this.render({
        processor: state,
        recorder: this.recorder.state,
      });
    });

    this.unsubscribeRecorder = this.recorder.subscribe((state) => {
      console.log("UPDATED STATE FROM RECORDER", state);

      this.state.recorder = state;
      this.render({
        processor: this.processor.state,
        recorder: state,
      });
    });
  }

  getViewType() {
    return VOX_RECORDER_VIEW;
  }

  getDisplayText() {
    return "VOX Recorder";
  }

  getIcon(): string {
    return "mic";
  }

  async onOpen() {
    this.root = createRoot(this.containerEl.children[1]);
    this.render(this.state);
  }

  render(state: ViewState) {
    if (!this.root) {
      return null;
    }

    const handleQueueFile = async (filepath: string) => {
      const transcribedFilesInfo = await this.processor.getTranscribedFiles();
      const candidate = await this.processor.getTranscribedStatus(filepath, transcribedFilesInfo);
      await this.processor.queueFile(candidate);
    };

    this.root.render(
      <React.StrictMode>
        <VoxPanelRecorder
          plugin={this.plugin}
          recorderState={state.recorder}
          processorState={state.processor}
          recorderStart={() => this.recorder.record(this.plugin.settings.recordingDeviceId)}
          recorderStop={() => this.recorder.stop()}
          recorderPause={() => this.recorder.pause()}
          recorderResume={() => this.recorder.resume()}
          onQueueFile={handleQueueFile}
        />
      </React.StrictMode>,
    );
  }

  async onClose() {
    this.root?.unmount();
    this.unsubscribeProcessor();
    this.unsubscribeRecorder();
  }
}

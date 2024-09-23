import { AudioRecorderState } from "AudioRecorder";
import { TranscriptionProcessorState } from "TranscriptionProcessor";
import VoxPlugin from "main";
import { setIcon } from "obsidian";
import React, { useEffect } from "react";
import ActionIcon from "./ActionIcon";

type Props = {
  plugin: VoxPlugin;
  recorderState: AudioRecorderState;
  processorState: TranscriptionProcessorState;

  recorderStart: () => Promise<void>;
  recorderStop: () => Promise<Blob>;
  recorderResume: () => void;
  recorderPause: () => void;
};

const VoxPanelRecorder = (props: Props) => {
  // const { plugin, recorderState, processorState, recorderStart, recorderStop, recorderPause, recorderResume } = props;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.50em",
      }}
    >
      <AudioRecorderBox {...props} />

      <FileTranscriptionInfo />
    </div>
  );
};

const FileTranscriptionInfo = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5em",
      }}
    >
      {/* Recording File Details */}
      <input
        style={{
          width: "100%",
          backgroundColor: "var(--dropdown-background)",
        }}
        type="text"
        placeholder="Note title"
        spellCheck={false}
      ></input>

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "0.25em",
        }}
      >
        <select style={{ flex: 1 }} defaultChecked={true} defaultValue="" className="dropdown">
          <option value="">Category</option>
          <option value="RA">Ramble</option>
          <option>Politics</option>
          <option>Blah blah</option>
          <option>Ramble</option>
        </select>

        <select className="dropdown">
          <option>1</option>
          <option>2</option>
          <option>3</option>
          <option>4</option>
          <option>5</option>
        </select>
      </div>

      {/* <div
        style={{
          flex: "1",
          padding: "0.5em",
          backgroundColor: "var(--background-secondary-alt)",
          fontSize: "var(--font-smallest)",
          fontFamily: "var(--font-monospace)",
          borderRadius: "var(--radius-s)",
        }}
      >
        R0XX {"{{ title }}"}.{}
      </div> */}

      <button className="disabled mod-cta">Add to queue</button>
    </div>
  );
};

const AudioRecorderBox = ({
  plugin,
  recorderState,
  processorState,
  recorderStart,
  recorderStop,
  recorderPause,
  recorderResume,
}: Props) => {
  const refRecordIcon = React.useRef<HTMLDivElement>(null);
  // const [isRecording, setIsRecording] = React.useState(false);

  // Use these to calculate the duration.
  // const chunks: AudioChunk[] = []

  useEffect(() => {
    if (!refRecordIcon.current) {
      return;
    }

    setIcon(refRecordIcon.current, "mic", 22);
  }, [recorderState.recordingState]);

  console.log("VoxPanelRecorder ➡️ recorderState.blob:", recorderState.blob);

  return (
    <div
      style={{
        position: "relative",
        padding: "0.25em",
        borderRadius: "var(--radius-m)",
        border: "1px solid var(--tab-outline-color)",
        // backgroundColor: "var(--tab-background-active)",
        backgroundColor: "var(--dropdown-background)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "0.25em",
        }}
      >
        {recorderState.recordingState === "paused" ? (
          <ActionIcon icon="mic" label="Resume Recording" onClick={() => recorderResume()} />
        ) : (
          <ActionIcon icon="pause" label="Pause Recording" onClick={() => recorderPause()} />
        )}

        {/* Recording Stats */}
        <div
          style={{
            flex: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--background-primary)",
            borderRadius: "var(--radius-m)",
            fontSize: "var(--font-smallest)",
            padding: "0 0.75em",
          }}
        >
          <span>
            13:59 <span style={{ opacity: 0.5 }}>/ 20:00</span>
          </span>{" "}
          <span style={{ opacity: 0.5 }}>19.35 MB</span>
        </div>

        <ActionIcon
          isDisabled={true}
          icon="x"
          label="Cancel Recording"
          isActive={false}
          onClick={() => recorderStop()}
        />

        <ActionIcon
          isDisabled={true}
          icon="check"
          label="Save Recording"
          isActive={false}
          onClick={() => recorderStop()}
        />
      </div>

      {recorderState.recordingState === "idle" && (
        <div
          onClick={recorderStart}
          ref={refRecordIcon}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: "var(--radius-m)",
            border: "1px solid var(--tab-outline-color)",
            backgroundColor: "var(--dropdown-background)",
          }}
        />
      )}
    </div>
  );
};

export default VoxPanelRecorder;

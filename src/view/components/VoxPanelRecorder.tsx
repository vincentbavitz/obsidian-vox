import { AudioRecorderState } from "AudioRecorder";
import { TranscriptionProcessorState } from "TranscriptionProcessor";
import VoxPlugin from "main";
import { Notice, setIcon } from "obsidian";
import React, { useEffect, useState } from "react";
import { DateTime } from "luxon";
import ActionIcon from "./ActionIcon";

type Props = {
  plugin: VoxPlugin;
  recorderState: AudioRecorderState;
  processorState: TranscriptionProcessorState;

  recorderStart: () => Promise<void>;
  recorderStop: () => Promise<Blob>;
  recorderResume: () => void;
  recorderPause: () => void;
  onQueueFile?: (filepath: string) => Promise<void>;
};

const VoxPanelRecorder = (props: Props) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.50em",
      }}
    >
      <AudioRecorderBox {...props} />

      <FileTranscriptionInfo
        plugin={props.plugin}
        recorderState={props.recorderState}
        processorState={props.processorState}
        recorderStop={props.recorderStop}
        onQueueFile={props.onQueueFile}
      />
    </div>
  );
};

type FileTranscriptionInfoProps = {
  plugin: VoxPlugin;
  recorderState: AudioRecorderState;
  processorState: TranscriptionProcessorState;
  recorderStop: () => Promise<Blob>;
  handleCancel?: () => void;
  onQueueFile?: (filepath: string) => Promise<void>;
};

const FileTranscriptionInfo = ({
  plugin,
  recorderState,
  processorState,
  recorderStop,
  onQueueFile,
}: FileTranscriptionInfoProps) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [importance, setImportance] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Generate a default title with "Recording YYYY-MM-DD" format
   * If a recording with that title already exists, append a number
   */
  const generateDefaultTitle = async (): Promise<string> => {
    const dateStr = DateTime.now().toFormat("yyyy-MM-dd");
    const baseTitle = `Recording ${dateStr}`;
    let finalTitle = baseTitle;
    let counter = 1;

    const watchDir = plugin.settings.watchDirectory;
    const folder = plugin.app.vault.getAbstractFileByPath(watchDir);

    // Check if title already exists
    while (folder && "children" in folder) {
      const children = (folder as any).children as any[];
      const exists = children.some((file: any) => file.name.startsWith(finalTitle.replace(/\s/g, "-")));

      if (!exists) {
        break;
      }

      finalTitle = `${baseTitle} ${counter}`;
      counter++;
    }

    return finalTitle;
  };

  /**
   * Save the recording to the watch directory and trigger transcription
   */
  const handleSaveAndTranscribe = async () => {
    if (recorderState.audio.blob === null) {
      new Notice("No recording to save.");
      return;
    }

    // Generate default title if empty
    let finalTitle = title.trim();
    if (!finalTitle) {
      finalTitle = await generateDefaultTitle();
    }

    setIsSaving(true);

    try {
      // Build the filename with format: R{importance}{categoryKey} {title}.webm
      const categoryKey = category || "XX";
      const filename = `R${importance}${categoryKey} ${finalTitle}.webm`;
      const filepath = `${plugin.settings.watchDirectory}/${filename}`;

      // Convert blob to ArrayBuffer and save
      const arrayBuffer = await recorderState.audio.blob.arrayBuffer();
      await plugin.app.vault.adapter.writeBinary(filepath, arrayBuffer);

      // Add to transcription queue
      if (onQueueFile) {
        await onQueueFile(filepath);
      }

      new Notice(`Recording saved: ${finalTitle}`);

      // Reset form
      setTitle("");
      setCategory("");
      setImportance(1);

      // Reset recorder state by clicking stop
      await recorderStop();
    } catch (error) {
      console.error("Error saving recording:", error);
      new Notice("Error saving recording. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const isRecording = recorderState.recordingState !== "idle";
  const canSave = recorderState.audio.blob !== null && !isRecording && !isSaving;

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
        placeholder="Note title (auto-generated if empty)"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        spellCheck={false}
        disabled={isRecording}
      />

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "0.25em",
        }}
      >
        <select
          style={{ flex: 1 }}
          value={category}
          onChange={(e) => setCategory(e.currentTarget.value)}
          className="dropdown"
          disabled={isRecording}
        >
          <option value="">No category (XX)</option>
          {Object.entries(plugin.settings.categoryMap).map(([key, label]) => (
            <option key={key} value={key}>
              {label} ({key})
            </option>
          ))}
        </select>

        <select
          className="dropdown"
          value={importance}
          onChange={(e) => setImportance(Number(e.currentTarget.value) as 1 | 2 | 3 | 4 | 5)}
          disabled={isRecording}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5</option>
        </select>
      </div>

      <button className={`mod-cta${!canSave ? " disabled" : ""}`} onClick={handleSaveAndTranscribe} disabled={!canSave}>
        {isSaving ? "Saving..." : "Save & transcribe"}
      </button>
    </div>
  );
};

const formatDuration = (durationSeconds: number) => {
  const SECONDS_IN_MINUTE = 60;
  const mm = Math.floor(durationSeconds / SECONDS_IN_MINUTE);
  const ss = Math.floor(durationSeconds % SECONDS_IN_MINUTE);
  return `${mm}:${ss < 10 ? "0" : ""}${ss}`;
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

  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!refRecordIcon.current) {
      return;
    }

    setIcon(refRecordIcon.current, "mic", 22);
  }, [recorderState.recordingState]);

  // Reset duration when recording starts
  useEffect(() => {
    if (recorderState.recordingState === "idle") {
      setDuration(0);
    }
  }, [recorderState.recordingState]);

  console.log("VoxPanelRecorder ➡️ duration:", duration);

  // Update real duration each second
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (recorderState.recordingState !== "recording") {
        return;
      }

      if (recorderState.audio.currentChunkStart) {
        const msIntoCurrentChunk = Date.now() - recorderState.audio.currentChunkStart;
        setDuration(recorderState.audio.duration + msIntoCurrentChunk / 1000);
      } else {
        setDuration(recorderState.audio.duration);
      }
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const durationFormatted = formatDuration(duration);

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
            lineHeight: "1em",
          }}
        >
          <div
            style={{
              display: "block",
              backgroundColor: "#FF0000",
              height: "0.35rem",
              width: "0.35rem",
              borderRadius: "10rem",
            }}
          />

          <span>
            {durationFormatted} <span style={{ opacity: 0.5 }}>/ 20:00</span>
          </span>

          {/* <span style={{ opacity: 0.5 }}>19.35 MB</span> */}
        </div>

        {/* <ActionIcon
          isDisabled={true}
          icon="x"
          label="Cancel Recording"
          isActive={false}
          onClick={() => recorderStop()}
        /> */}

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

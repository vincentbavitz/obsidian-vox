import clsx from "clsx";
import { setIcon, WorkspaceLeaf } from "obsidian";
import React from "react";
import { TranscriptionProcessorState } from "TranscriptionProcessor";
import { VoxStatusItem, VoxStatusItemStatus } from "types";

type Props = {
  leaf: WorkspaceLeaf;
  state: TranscriptionProcessorState;
  onClickPause: () => void;
  onClickResume: () => void;
};

export const VoxStatus = ({ state, leaf, onClickPause, onClickResume }: Props) => {
  const refStartButton = React.useRef<HTMLDivElement>(null);
  const refPauseButton = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!refStartButton.current || !refPauseButton.current) {
      return;
    }

    setIcon(refStartButton.current, "play");
    setIcon(refPauseButton.current, "pause");
  }, []);

  const items = Object.values(state.items).sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

  const processingAudio = items.filter((item) => item.status === VoxStatusItemStatus.PROCESSING_AUDIO);
  const transcribing = items.filter((item) => item.status === VoxStatusItemStatus.TRANSCRIBING);
  const awaiting = items.filter((item) => item.status === VoxStatusItemStatus.QUEUED);

  const processing = [...transcribing, ...processingAudio, ...awaiting];
  const completed = items.filter((item) => item.status === VoxStatusItemStatus.COMPLETE);
  const failed = items.filter((item) => item.status === VoxStatusItemStatus.FAILED);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "var(--p-spacing)",
        }}
      >
        <h4
          style={{
            flex: 1,
            margin: 0,
          }}
        >
          Vox Status
        </h4>

        <div className="nav-buttons-container">
          <div
            ref={refStartButton}
            style={{
              width: "min-content",
            }}
            onClick={onClickResume}
            className={clsx("clickable-icon nav-action-button", state.running ? "is-active" : "")}
            aria-label="Start VOX"
          />

          <div
            ref={refPauseButton}
            style={{
              width: "min-content",
            }}
            onClick={onClickPause}
            className={clsx("clickable-icon nav-action-button", state.running ? "" : "is-active")}
            aria-label="Pause VOX"
          />
        </div>
      </div>

      <StatusItemList heading="Transcription Queue" items={processing} />

      {completed.length > 0 && <StatusItemList heading="Complete" items={completed} />}
      {failed.length > 0 && <StatusItemList heading="Failed" items={failed} />}
    </div>
  );
};

const StatusItemList = ({ heading, items }: { heading: string; items: VoxStatusItem[] }) => {
  const count = items.length;

  return (
    <div
      style={{
        marginBottom: "var(--p-spacing)",
      }}
    >
      <p>
        {heading} ({count})
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5em",
        }}
      >
        {items.map((item) => (
          <StatusItem key={item.hash} {...item} />
        ))}
      </div>
    </div>
  );
};

const STATUS_LABEL_MAP = {
  [VoxStatusItemStatus.QUEUED]: "QUEUED",
  [VoxStatusItemStatus.PROCESSING_AUDIO]: "PROCESSING",
  [VoxStatusItemStatus.TRANSCRIBING]: "TRANSCRIBING",
  [VoxStatusItemStatus.COMPLETE]: "DONE",
  [VoxStatusItemStatus.FAILED]: "FAILED",
};

const STATUS_ICON_MAP = {
  [VoxStatusItemStatus.QUEUED]: "ellipsis",
  [VoxStatusItemStatus.PROCESSING_AUDIO]: "combine",
  [VoxStatusItemStatus.TRANSCRIBING]: "loader",
  [VoxStatusItemStatus.COMPLETE]: "check",
  [VoxStatusItemStatus.FAILED]: "circle-slash",
};

const STATUS_COLOR_MAP = {
  [VoxStatusItemStatus.QUEUED]: "var(--text-faint)",
  [VoxStatusItemStatus.PROCESSING_AUDIO]: "var(--color-yellow)",
  [VoxStatusItemStatus.TRANSCRIBING]: "var(--color-cyan)",
  [VoxStatusItemStatus.COMPLETE]: "var(--color-green)",
  [VoxStatusItemStatus.FAILED]: "var(--color-red)",
};

const StatusItem = ({ details, status }: VoxStatusItem) => {
  const refIcon = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!refIcon.current) {
      return;
    }

    setIcon(refIcon.current, STATUS_ICON_MAP[status]);
  }, []);

  return (
    <div
      style={{
        padding: "0.5em",
        borderRadius: "var(--radius-s)",
        backgroundColor: "var(--background-secondary-alt)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5em",
        }}
      >
        {/* <div
          style={{
            aspectRatio: "1",
          }}
          ref={refIcon}
        /> */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            gap: "0.5em",
          }}
        >
          <div
            className="nav-file-title-content"
            style={{
              flex: 1,
              fontSize: "var(--nav-item-size)",
              margin: 0,
              opacity: 0.75,
            }}
          >
            {details.name}
          </div>

          <div
            className="nav-file-tag"
            style={{
              backgroundColor: STATUS_COLOR_MAP[status],
              color: "var(--text-on-accent-inverted)",
            }}
          >
            {STATUS_LABEL_MAP[status]}
          </div>
        </div>
      </div>
    </div>
  );
};

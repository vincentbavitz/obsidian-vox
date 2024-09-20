import { setIcon } from "obsidian";
import React from "react";
import { VoxStatusItem, VoxStatusItemStatus } from "types";

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

const VoxStatusListItem = ({ details, status }: VoxStatusItem) => {
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

export default VoxStatusListItem;

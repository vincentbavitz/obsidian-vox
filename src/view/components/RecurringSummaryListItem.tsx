import { setIcon } from "obsidian";
import React from "react";
import { RecurringSummaryItem, RecurringSummaryStatus } from "types";

const STATUS_LABEL_MAP = {
  [RecurringSummaryStatus.PENDING]: "PENDING",
  [RecurringSummaryStatus.GENERATING]: "GENERATING",
  [RecurringSummaryStatus.COMPLETE]: "DONE",
  [RecurringSummaryStatus.FAILED]: "FAILED",
};

const STATUS_ICON_MAP = {
  [RecurringSummaryStatus.PENDING]: "ellipsis",
  [RecurringSummaryStatus.GENERATING]: "sparkles",
  [RecurringSummaryStatus.COMPLETE]: "check",
  [RecurringSummaryStatus.FAILED]: "circle-slash",
};

const STATUS_COLOR_MAP = {
  [RecurringSummaryStatus.PENDING]: "var(--text-faint)",
  [RecurringSummaryStatus.GENERATING]: "var(--color-purple)",
  [RecurringSummaryStatus.COMPLETE]: "var(--color-green)",
  [RecurringSummaryStatus.FAILED]: "var(--color-red)",
};

const RecurringSummaryListItem = ({ label, status }: RecurringSummaryItem) => {
  const refIcon = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!refIcon.current) {
      return;
    }

    setIcon(refIcon.current, STATUS_ICON_MAP[status]);
  }, [status]);

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
            {label}
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

export default RecurringSummaryListItem;

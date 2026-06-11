import React from "react";
import { RecurringSummaryItem } from "types";
import RecurringSummaryListItem from "./RecurringSummaryListItem";

type Props = { items: RecurringSummaryItem[] };

// React must be explicitly imported for client-side runtime rendering;
React;

const RecurringSummaryList = ({ items }: Props) => {
  const count = items.length;

  return (
    <div
      style={{
        marginBottom: "var(--p-spacing)",
      }}
    >
      <p>
        Recurring Summaries ({count})
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5em",
        }}
      >
        {items.map((item) => (
          <RecurringSummaryListItem key={item.id} {...item} />
        ))}
      </div>
    </div>
  );
};

export default RecurringSummaryList;

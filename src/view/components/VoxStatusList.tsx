import React from "react";
import { VoxStatusItem } from "types";
import VoxStatusListItem from "./VoxStatusListItem";

type Props = { heading: string; items: VoxStatusItem[] };

// React must be explicitly imported for client-side runtime rendering;
React;

const VoxStatusList = ({ heading, items }: Props) => {
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
          <VoxStatusListItem key={item.hash} {...item} />
        ))}
      </div>
    </div>
  );
};

export default VoxStatusList;

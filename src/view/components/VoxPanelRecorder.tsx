import React from "react";
import ActionIcon from "./ActionIcon";

// React must be explicitly imported for client-side runtime rendering;
React;

const VoxPanelRecorder = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.50em",
        marginBottom: "var(--p-spacing)",
      }}
    >
      <AudioRecorderBox />
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
        padding: "0.5em",
        gap: "0.5em",
        borderRadius: "var(--radius-m)",
        border: "1px solid var(--tab-outline-color)",
        backgroundColor: "var(--tab-background-active)",
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

      <div
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
      </div>

      <button className="disabled mod-cta">Add to queue</button>
    </div>
  );
};

const AudioRecorderBox = () => {
  return (
    <div
      style={{
        padding: "0.5em",
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
        <ActionIcon icon="mic" label="Start Recording" isActive={true} onClick={() => null} />

        {/* Recording Stats */}
        <div
          style={{
            flex: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--background-primary)",
            borderRadius: "var(--radius-s)",
            fontSize: "var(--font-smallest)",
            padding: "0 0.75em",
          }}
        >
          <span>
            13:59 <span style={{ opacity: 0.5 }}>/ 20:00</span>
          </span>{" "}
          <span>19.35 MB</span>
        </div>

        <ActionIcon isDisabled={true} icon="x" label="Cancel Recording" isActive={false} onClick={() => null} />
        <ActionIcon isDisabled={true} icon="check" label="Save Recording" isActive={false} onClick={() => null} />
      </div>
    </div>
  );
};

export default VoxPanelRecorder;

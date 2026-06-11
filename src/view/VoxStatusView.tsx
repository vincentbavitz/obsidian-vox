import { setIcon, WorkspaceLeaf } from "obsidian";
import React from "react";
import { TranscriptionProcessorState } from "TranscriptionProcessor";
import { SummarizationSchedulerState } from "SummarizationScheduler";
import { VoxStatusItemStatus } from "types";
import ActionIcon from "./components/ActionIcon";
import VoxStatusList from "./components/VoxStatusList";
import RecurringSummaryList from "./components/RecurringSummaryList";

type Props = {
  leaf: WorkspaceLeaf;
  processorState: TranscriptionProcessorState;
  schedulerState: SummarizationSchedulerState;
  onClickPause: () => void;
  onClickResume: () => void;
};

export const VoxStatus = ({ processorState, schedulerState, leaf, onClickPause, onClickResume }: Props) => {
  const refStartButton = React.useRef<HTMLDivElement>(null);
  const refPauseButton = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!refStartButton.current || !refPauseButton.current) {
      return;
    }

    setIcon(refStartButton.current, "play");
    setIcon(refPauseButton.current, "pause");
  }, []);

  const items = Object.values(processorState.items).sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

  const processingAudio = items.filter((item) => item.status === VoxStatusItemStatus.PROCESSING_AUDIO);
  const transcribing = items.filter((item) => item.status === VoxStatusItemStatus.TRANSCRIBING);
  const summarizing = items.filter((item) => item.status === VoxStatusItemStatus.SUMMARIZING);
  const awaiting = items.filter((item) => item.status === VoxStatusItemStatus.QUEUED);

  const processing = [...transcribing, ...summarizing, ...processingAudio, ...awaiting];
  const completed = items.filter((item) => item.status === VoxStatusItemStatus.COMPLETE);
  const failed = items.filter((item) => item.status === VoxStatusItemStatus.FAILED);

  const recurringItems = Object.values(schedulerState.items).sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

  return (
    <div>
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
            <ActionIcon icon="play" label="Start VOX" isActive={processorState.running} onClick={onClickResume} />
            <ActionIcon icon="pause" label="Pause VOX" isActive={!processorState.running} onClick={onClickPause} />
          </div>
        </div>

        <VoxStatusList heading="Transcription Queue" items={processing} />

        {completed.length > 0 && <VoxStatusList heading="Complete" items={completed} />}
        {failed.length > 0 && <VoxStatusList heading="Failed" items={failed} />}
        {recurringItems.length > 0 && <RecurringSummaryList items={recurringItems} />}
      </div>
    </div>
  );
};

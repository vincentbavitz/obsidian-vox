import clsx from "clsx";
import { setIcon } from "obsidian";
import React from "react";

type Props = {
  icon: string;
  label: string;
  isActive?: boolean;
  isDisabled?: boolean;

  onClick: () => void;
};

const ActionIcon = ({ icon, label, isActive = false, isDisabled = false, onClick }: Props) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    setIcon(ref.current, icon);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        aspectRatio: "1",
        width: "min-content",
      }}
      onClick={onClick}
      className={clsx("clickable-icon nav-action-button", isActive ? "is-active" : "", isDisabled ? "disabled" : "")}
      aria-label={label}
    />
  );
};

export default ActionIcon;

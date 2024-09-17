import React from "react";
import { VoxStatusMap } from "types";

type Props = {
  status: VoxStatusMap;
};

export const VoxStatus = ({ status }: Props) => {
  const processing = React.useMemo(() => [], []);

  console.log("VoxStatus ➡️ status:", status);

  return (
    <div>
      <h1>VOX Status</h1>
    </div>
  );
};

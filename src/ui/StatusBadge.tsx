import type { FindingStatus } from "../compliance/types";

type Props = {
  status: FindingStatus;
  label?: string;
};

export function StatusBadge({ status, label }: Props) {
  return <span className={`badge ${status}`}>{label ?? status}</span>;
}

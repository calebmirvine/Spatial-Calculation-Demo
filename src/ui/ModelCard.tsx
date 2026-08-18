import { useEffect, useRef, useState } from "react";
import type { Finding, FindingStatus, ModelId } from "../compliance/types";
import {
  findingDeltaText,
  findingLimitLabel,
  findingMeter,
  formatQuantity,
} from "../compliance/formatFinding";
import { StatusBadge } from "./StatusBadge";
import { useModelWorld } from "../viewer/useModelWorld";
import type { InspectedElement, ViewerHandle } from "../viewer/types";

type Props = {
  title: string;
  fileName: string;
  modelId: ModelId;
  status: FindingStatus;
  buffer: ArrayBuffer;
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ModelCard({
  title,
  fileName,
  modelId,
  status,
  buffer,
  findings,
  selectedId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ViewerHandle | null>(null);
  const [inspected, setInspected] = useState<InspectedElement | null>(null);
  const selected = findings.find((finding) => finding.id === selectedId) ?? null;
  const failFindings = findings.filter((finding) => finding.status === "fail");
  const passFindings = findings.filter((finding) => finding.status === "pass");
  const focusGuids = findings.flatMap((finding) => finding.highlightGlobalIds);

  useModelWorld(containerRef, {
    buffer,
    modelId,
    failFindings,
    passFindings,
    focusGuids,
    onReady: (handle) => {
      handleRef.current = handle;
      void handle.highlightFinding(selected);
    },
    onPick: (picked) => {
      setInspected(picked.inspected);
      const match = findings.find((finding) =>
        finding.highlightGlobalIds.some((guid) => picked.guids.includes(guid)),
      );
      if (match) onSelect(match.id);
    },
  });

  useEffect(() => {
    void handleRef.current?.highlightFinding(selected);
  }, [selected]);

  return (
    <section className={`card ${status}`}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          <code>{fileName}</code>
        </div>
        <StatusBadge status={status} />
      </header>
      <div className="card-stage">
        <div className="card-viewer" ref={containerRef} />
        {inspected && (
          <aside className="inspect">
            <strong>{inspected.name}</strong>
            <span>{inspected.category}</span>
            <code>
              {inspected.widthMm} × {inspected.heightMm} × {inspected.depthMm} mm
            </code>
            {(inspected.ifcWidthMm != null || inspected.ifcHeightMm != null) && (
              <code>
                IFC{" "}
                {[inspected.ifcWidthMm, inspected.ifcHeightMm]
                  .filter((value) => value != null)
                  .join(" × ")}{" "}
                mm
              </code>
            )}
          </aside>
        )}
      </div>
      <div className="card-findings">
        {findings.map((finding) => (
          <button
            key={finding.id}
            type="button"
            className={`finding${selectedId === finding.id ? " selected" : ""}`}
            onClick={() => onSelect(finding.id)}
          >
            <div className="finding-top">
              <span className="finding-title">{finding.title}</span>
              <StatusBadge status={finding.status} />
            </div>
            <p className="finding-element">{finding.elementName}</p>
            <p className="finding-values">
              Measured <code>{formatQuantity(finding.measured, finding.unit)}</code>
              <br />
              {findingLimitLabel(finding)}{" "}
              <code>{formatQuantity(finding.required, finding.unit)}</code>
            </p>
            <FindingMeter finding={finding} />
            <p className={`finding-delta ${finding.status}`}>
              {findingDeltaText(finding)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

function FindingMeter({ finding }: { finding: Finding }) {
  const { fill, mark } = findingMeter(finding);
  return (
    <div
      className={`finding-meter ${finding.status}`}
      title={`${formatQuantity(finding.measured, finding.unit)} vs ${findingLimitLabel(finding).toLowerCase()} ${formatQuantity(finding.required, finding.unit)}`}
    >
      <span className="finding-meter-fill" style={{ width: `${fill * 100}%` }} />
      <span className="finding-meter-limit" style={{ left: `${mark * 100}%` }} />
    </div>
  );
}

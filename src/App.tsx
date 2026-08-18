import { useEffect, useState } from "react";
import type { Finding, FindingsPayload } from "./compliance/types";
import { modelStatus } from "./compliance/findings";
import { ModelCard } from "./ui/ModelCard";
import { convertIfcToFragments } from "./viewer/convertIfc";
import { publicUrl } from "./viewer/publicUrl";
import type { LoadStatus } from "./viewer/types";

export default function App() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [selectedByModel, setSelectedByModel] = useState<Record<string, string | null>>({
    valid: null,
    invalid: null,
  });
  const [status, setStatus] = useState<LoadStatus>({
    phase: "Loading findings",
    progress: 0,
  });

  useEffect(() => {
    fetch(publicUrl("compliance/findings.json"))
      .then((response) => response.json())
      .then((payload: FindingsPayload) => {
        setFindings(payload.findings);
        setSelectedByModel({
          valid:
            payload.findings.find((finding) => finding.modelId === "valid")?.id ?? null,
          invalid:
            payload.findings.find(
              (finding) => finding.modelId === "invalid" && finding.status === "fail",
            )?.id ?? null,
        });
      })
      .catch((error) => console.error("Failed to load findings", error));
  }, []);

  useEffect(() => {
    convertIfcToFragments(publicUrl("models/BasicHouse.ifc"), setStatus)
      .then(setBuffer)
      .catch((error) => {
        console.error(error);
        setStatus({
          phase: error instanceof Error ? error.message : "Conversion failed",
          progress: 0,
        });
      });
  }, []);

  const validFindings = findings.filter((finding) => finding.modelId === "valid");
  const invalidFindings = findings.filter((finding) => finding.modelId === "invalid");
  const ready = Boolean(buffer) && findings.length > 0;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="mark" aria-hidden="true" />
          <div>
            <h1>Spatial Calculation Demo</h1>
            <span>Proof of concept</span>
          </div>
        </div>
      </header>
      <div className="stage">
        {!ready && (
          <div className="overlay">
            <div className="overlay-card">
              <p>{status.phase}</p>
              <div className="progress">
                <span style={{ width: `${Math.round(status.progress * 100)}%` }} />
              </div>
            </div>
          </div>
        )}
        {buffer && (
          <>
            <ModelCard
              title="Valid"
              fileName="BasicHouse.ifc"
              modelId="valid"
              status={modelStatus(findings, "valid")}
              buffer={buffer}
              findings={validFindings}
              selectedId={selectedByModel.valid}
              onSelect={(id) =>
                setSelectedByModel((current) => ({ ...current, valid: id }))
              }
            />
            <ModelCard
              title="Invalid"
              fileName="BasicHouseInvalid.ifc"
              modelId="invalid"
              status={modelStatus(findings, "invalid")}
              buffer={buffer}
              findings={invalidFindings}
              selectedId={selectedByModel.invalid}
              onSelect={(id) =>
                setSelectedByModel((current) => ({ ...current, invalid: id }))
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

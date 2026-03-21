import { formatEventPanelTitle } from "../../common/utils";
import { FileChangeDiff } from "../../workspace/components/FilePreviewParts";

export default function ChatMessageFeed({ renderItems }) {
  return renderItems.map((item, idx) => {
    if (item.type === "event_panel") {
      return (
        <div key={`file-panel:${idx}`} className="msg-row file-panel">
          <div className="file-change-panel">
            <div className="file-change-panel-scroll">
              {item.entries.map((entry, entryIdx) => (
                <div
                  key={`file-entry:${idx}:${entryIdx}`}
                  className={`file-change-entry kind-${entry.kind || "event"}`}
                >
                  {entry.kind !== "file_change" ? (
                    <div className="file-change-label">{formatEventPanelTitle(entry.kind)}</div>
                  ) : null}
                  <div className="file-change-summary">{entry.text}</div>
                  {entry.detail ? <div className="file-change-files">{entry.detail}</div> : null}
                  {Array.isArray(entry.files) && entry.files.length ? (
                    <div className="file-change-files">
                      {entry.files.map((file, fileIdx) => (
                        <div key={`${file.path || "file"}:${fileIdx}`}>
                          {(file.change_type || "M")} {file.path || "-"} (+{Number(file.additions || 0)} -{Number(file.deletions || 0)})
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {entry.rawReasoning ? (
                    <details className="event-panel-details">
                      <summary>Raw reasoning</summary>
                      <div className="file-change-files">{entry.rawReasoning}</div>
                    </details>
                  ) : null}
                  {entry.diff ? <FileChangeDiff diff={entry.diff} /> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    const m = item.message;
    return (
      <div key={idx} className={`msg-row ${m.role}`}>
        <div className={`msg ${m.role}${m.variant ? ` ${m.variant}` : ""}${m.kind ? ` kind-${m.kind}` : ""}`}>
          {m.kind === "plan" ? <div className="msg-label">Plan</div> : null}
          {m.kind === "plan_checklist" ? <div className="msg-label">Plan Checklist</div> : null}
          <div className="msg-body">{m.text}</div>
          {m.turnId ? <div className="msg-meta">turnId: {m.turnId}</div> : null}
        </div>
      </div>
    );
  });
}

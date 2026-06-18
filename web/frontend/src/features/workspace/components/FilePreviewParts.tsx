import { renderDiffRows } from "../../common/utils";
import { EmptyState } from "../../common/components/ui";

export function FileChangeDiff({ diff }) {
  const rows = renderDiffRows(diff);
  if (!rows.length) {
    return null;
  }
  return (
    <div className="file-change-code" role="table" aria-label="File change diff">
      {rows.map((row, index) => (
        <div key={`diff:${index}`} className={`file-change-code-row type-${row.type}`} role="row">
          <span className="file-change-code-line" role="cell">{row.left}</span>
          <span className="file-change-code-line" role="cell">{row.right}</span>
          <span className="file-change-code-text" role="cell">{row.text || " "}</span>
        </div>
      ))}
    </div>
  );
}

export function FileCodePreview({ content }) {
  const rows = typeof content === "string" ? content.split("\n") : [];
  if (!rows.length) {
    return (
      <EmptyState className="workspace-preview-empty">File is empty.</EmptyState>
    );
  }
  return (
    <div className="file-change-code workspace-file-code" role="table" aria-label="File preview">
      {rows.map((row, index) => (
        <div key={`file:${index}`} className="file-change-code-row type-ctx" role="row">
          <span className="file-change-code-line" role="cell">{index + 1}</span>
          <span className="file-change-code-line" role="cell" />
          <span className="file-change-code-text" role="cell">{row || " "}</span>
        </div>
      ))}
    </div>
  );
}

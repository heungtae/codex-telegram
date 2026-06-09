import { normalizeThreadId } from "../../common/utils";
import { EmptyState, Panel } from "../../common/components/ui";

export default function SidebarThreadsPanel({
  interactionBusy,
  threadItems,
  activeThread,
  viewThread,
}) {
  return (
    <Panel className="threads-panel">
      <div className="panel-head">
        <h3>Threads</h3>
      </div>
      <div className="thread-list">
        {threadItems.map((item) => (
          <button
            key={item.id}
            className={`thread-item ${normalizeThreadId(item.id) === normalizeThreadId(activeThread) ? "active" : ""}`}
            onClick={() => viewThread(item.id)}
            disabled={interactionBusy}
            type="button"
          >
            <div className="thread-title">{item.title || "Untitled"}</div>
            <div className="thread-sub">{item.id}</div>
          </button>
        ))}
        {threadItems.length ? null : (
          <EmptyState className="panel-note">No open threads.</EmptyState>
        )}
      </div>
    </Panel>
  );
}

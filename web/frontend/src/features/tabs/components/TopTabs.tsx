import { normalizeThreadId } from "../../common/utils";
import { IconButton } from "../../common/components/ui";

export default function TopTabs({
  projectTabs,
  activeProjectTabId,
  projectTabStatusById,
  onSelectProjectTab,
  onCloseProjectTab,
  threadTabs,
  activeThread,
  onSelectThread,
  onCloseThread,
  onAddThread,
  disableAddThread,
}) {
  return (
    <div className="top-tabs">
      <div className="project-tabs-row">
        {projectTabs.map((tab) => (
          <div
            key={tab.id}
            className={`project-tab-chip ${tab.id === activeProjectTabId ? "active" : ""} state-${projectTabStatusById[tab.id] || "idle"}`}
          >
            <button
              type="button"
              className="project-tab-main"
              onClick={() => onSelectProjectTab(tab.id)}
            >
              {tab.name}
            </button>
            <IconButton
              className="project-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onCloseProjectTab(tab.id);
              }}
              ariaLabel={`Close project ${tab.name}`}
              title="Close project tab"
            >
              <img className="tab-action-icon" src="/assets/icons-tab-close.svg" alt="" aria-hidden="true" />
            </IconButton>
          </div>
        ))}
      </div>
      <div className="turn-tabs-row">
        {threadTabs.map((tab) => (
          <div
            key={tab.id}
            className={`turn-tab-chip ${normalizeThreadId(tab.id) === normalizeThreadId(activeThread) ? "active" : ""} state-${tab.status || "idle"} ${tab.hasUnreadCompletion ? "unread" : ""}`}
          >
            <button
              type="button"
              className="turn-tab-main"
              onClick={() => onSelectThread(tab.id)}
            >
              <span className="turn-tab-title">{tab.title || tab.id}</span>
              {tab.hasUnreadCompletion ? <span className="turn-tab-dot" /> : null}
            </button>
            <IconButton
              className="turn-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onCloseThread(tab.id);
              }}
              ariaLabel={`Close thread ${tab.title || tab.id}`}
              title="Close thread tab"
            >
              <img className="tab-action-icon" src="/assets/icons-tab-close.svg" alt="" aria-hidden="true" />
            </IconButton>
          </div>
        ))}
        <IconButton
          className="turn-tab-add"
          onClick={onAddThread}
          ariaLabel="Add thread tab"
          title="Add thread tab"
          disabled={disableAddThread}
        >
          <img className="tab-action-icon" src="/assets/icons-tab-add.svg" alt="" aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}

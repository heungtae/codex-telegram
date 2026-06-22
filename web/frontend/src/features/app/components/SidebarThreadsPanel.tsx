import { IconButton } from "../../common/components/ui";
import { CloseIcon, ComposeIcon } from "../../common/components/Icons";
import CollapsibleSection from "../../common/components/CollapsibleSection";
import { normalizeThreadId } from "../../common/utils";

export default function SidebarThreadsPanel({
  activeProjectTabId,
  threadItems,
  threadTabsByProjectTabId,
  activeThread,
  onSelectThread,
  onCloseThread,
  onAddThread,
  disableAddThread,
  defaultOpen = true,
}) {
  const threadTabs = threadTabsByProjectTabId[activeProjectTabId] || [];
  const handleSelectThread = (threadId) => onSelectThread(activeProjectTabId, threadId);
  const handleCloseThread = (threadId) => onCloseThread(activeProjectTabId, threadId);
  const handleAddThread = () => onAddThread(activeProjectTabId);

  const rows = threadItems.map((item) => {
    const openedTab = threadTabs.find(
      (tab) => normalizeThreadId(tab.id) === normalizeThreadId(item.id)
    );
    return openedTab ? { ...item, ...openedTab, isOpen: true } : item;
  });

  return (
    <CollapsibleSection
      title="Threads"
      defaultOpen={defaultOpen}
      sectionClassName="threads-section"
      toggleClassName="threads-toggle"
      labelClassName="threads-toggle-label"
      chevronClassName="threads-toggle-chevron"
      listClassName="threads-list"
      headerActions={
        <IconButton
          className="threads-compose-btn"
          onClick={handleAddThread}
          aria-label="Add thread"
          title="New thread"
          disabled={disableAddThread}
        >
          <ComposeIcon />
        </IconButton>
      }
    >
      {rows.map((tab) => {
        const isActive = normalizeThreadId(tab.id) === normalizeThreadId(activeThread);
        return (
          <div
            key={tab.id}
            className={`thread-tab-item${isActive ? " active" : ""} state-${tab.status || "idle"}${tab.hasUnreadCompletion ? " unread" : ""}`}
          >
            <button
              type="button"
              className="session-tab-main"
              onClick={() => handleSelectThread(tab.id)}
            >
              <span className="session-tab-title">{tab.title || tab.id}</span>
              {tab.hasUnreadCompletion ? <span className="session-tab-dot" /> : null}
            </button>
            {tab.isOpen ? (
              <IconButton
                className="session-tab-close"
                onClick={(event) => {
                  event.stopPropagation();
                  handleCloseThread(tab.id);
                }}
                aria-label={`Close thread ${tab.title || tab.id}`}
                title="Close thread tab"
              >
                <CloseIcon />
              </IconButton>
            ) : null}
          </div>
        );
      })}
      {rows.length === 0 ? (
        <div className="panel-note">No threads in this project.</div>
      ) : null}
    </CollapsibleSection>
  );
}

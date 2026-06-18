import { useId, useState } from "react";

import { IconButton } from "../../common/components/ui";
import { ComposeIcon } from "../../common/components/Icons";
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
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const listId = useId();

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
    <section className="threads-section">
      <div className="panel-head">
        <button
          type="button"
          className={`threads-toggle${isOpen ? " open" : ""}`}
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-controls={listId}
        >
          <span className="threads-toggle-label">Threads</span>
          <span className="threads-toggle-chevron" aria-hidden="true" />
        </button>
        <IconButton
          className="threads-compose-btn"
          onClick={handleAddThread}
          ariaLabel="Add thread"
          title="New thread"
          disabled={disableAddThread}
        >
          <ComposeIcon />
        </IconButton>
      </div>
      {isOpen ? (
        <div id={listId} className="threads-list">
          {rows.map((tab) => {
            const isActive =
              normalizeThreadId(tab.id) === normalizeThreadId(activeThread);
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
                    ariaLabel={`Close thread ${tab.title || tab.id}`}
                    title="Close thread tab"
                  >
                    <img
                      className="tab-action-icon"
                      src="/assets/icons-tab-close.svg"
                      alt=""
                      aria-hidden="true"
                    />
                  </IconButton>
                ) : null}
              </div>
            );
          })}
          {rows.length === 0 ? (
            <div className="panel-note">No threads in this project.</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

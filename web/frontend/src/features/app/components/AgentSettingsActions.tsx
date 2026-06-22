import { RefreshIcon, SaveIcon } from "../../common/components/Icons";

type AgentSettingsActionsProps = {
  settingsBusy: boolean;
  onRefresh: () => void;
  onSave: () => void;
};

export default function AgentSettingsActions({ settingsBusy, onRefresh, onSave }: AgentSettingsActionsProps) {
  return (
    <div className="agent-settings-actions">
      <button
        className="agent-settings-action"
        type="button"
        onClick={onRefresh}
        disabled={settingsBusy}
        aria-label="Refresh"
        title="Refresh"
      >
        <RefreshIcon />
      </button>
      <button
        className="agent-settings-action agent-settings-action-primary"
        type="button"
        onClick={onSave}
        disabled={settingsBusy}
        aria-label="Save"
        title="Save"
      >
        <SaveIcon />
      </button>
    </div>
  );
}

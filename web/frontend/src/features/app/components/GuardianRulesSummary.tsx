import { SettingsIcon } from "../../common/components/Icons";

export default function GuardianRulesSummary({
  guardianRuleSummary,
  floatingAgentSettings,
  toggleFloatingAgentSettings,
  settingsBusy,
}) {
  return (
    <div className="agent-settings-summary">
      <div className="agent-settings-summary-title">
        Rules: {guardianRuleSummary.enabled || 0}/{guardianRuleSummary.total || 0} enabled
      </div>
      {guardianRuleSummary.action_counts ? (
        <div className="agent-settings-summary-actions">
          {["approve", "session", "deny", "manual_fallback"].map((action) => (
            <span key={action}>
              {action}: {guardianRuleSummary.action_counts[action] || 0}
            </span>
          ))}
        </div>
      ) : null}
      {Array.isArray(guardianRuleSummary.top) && guardianRuleSummary.top.length ? (
        <div className="agent-settings-summary-list">
          {guardianRuleSummary.top.slice(0, 3).map((rule, index) => (
            <div key={`${rule.name || "rule"}:${index}`} className="agent-settings-summary-item">
              <span>{rule.name || "unnamed-rule"}</span>
              <span>{`${rule.action || "deny"} 鸚?p${rule.priority || 0}`}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="agent-settings-empty">No guardian policy rules configured.</div>
      )}
      <div className="agent-settings-summary-footer">
        <button
          className={`agent-settings-inline-btn ${floatingAgentSettings === "guardian" ? "active" : ""}`}
          type="button"
          onClick={() => toggleFloatingAgentSettings("guardian")}
          disabled={settingsBusy}
          aria-label="Rules TOML"
          title="Rules TOML"
        >
          <SettingsIcon />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}

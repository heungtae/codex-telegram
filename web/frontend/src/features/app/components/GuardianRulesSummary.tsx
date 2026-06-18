import React from "react";

const ACTION_LABELS = {
  approve: "Approve",
  session: "Approve for session",
  deny: "Deny",
  manual_fallback: "Ask for approval",
};

export default function GuardianRulesSummary({
  guardianRuleSummary,
  floatingAgentSettings,
  toggleFloatingAgentSettings,
  settingsBusy,
}) {
  const enabled = guardianRuleSummary?.enabled || 0;
  const total = guardianRuleSummary?.total || 0;
  const actionCounts = guardianRuleSummary?.action_counts || {};
  const visibleActions = Object.entries(ACTION_LABELS).filter(
    ([action]) => (actionCounts[action] || 0) > 0
  );

  return (
    <section className="guardian-rules-section">
      <div className="guardian-rules-head">
        <h3>Rules</h3>
        <span className="guardian-rules-status">
          {total > 0 ? `${enabled} of ${total} enabled` : `${enabled} enabled`}
        </span>
      </div>
      {visibleActions.length ? (
        <div className="guardian-rules-actions">
          {visibleActions.map(([action, label]) => (
            <span key={action}>
              <strong>{actionCounts[action]}</strong>
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {total === 0 ? <p className="guardian-rules-empty">No rules configured yet.</p> : null}
      <div className="guardian-rules-footer">
        <button
          className={`guardian-rules-configure${floatingAgentSettings === "guardian" ? " active" : ""}`}
          type="button"
          onClick={() => toggleFloatingAgentSettings("guardian")}
          disabled={settingsBusy}
          aria-label="Rules TOML"
          title="Rules TOML"
        >
          <span>Configure rules</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}

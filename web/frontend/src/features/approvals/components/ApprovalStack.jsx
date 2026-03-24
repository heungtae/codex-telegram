export default function ApprovalStack({ approvalItems, approvalBusyId, onSubmitApproval, onClose }) {
  if (!approvalItems.length) {
    return null;
  }
  return (
    <>
      <div className="approval-overlay" />
      <div className="approval-stack">
        {approvalItems.map((item) => (
          <div key={item.id} className="approval">
            <div className="approval-header">
              <div className="approval-title">Approval required</div>
              <button className="approval-close" type="button" onClick={onClose}>
                ✕
              </button>
            </div>
            <div>Method: {item.method || "-"}</div>
            <div>Request ID: {item.id}</div>
            {item.policy_rule ? <div>Policy: {item.policy_rule}</div> : null}
            {item.reason ? <div>Reason: {item.reason}</div> : null}
            {item.question ? <div>Question: {item.question}</div> : null}
            <div className="approval-actions">
              <button
                className="secondary"
                type="button"
                disabled={approvalBusyId === item.id}
                onClick={() => onSubmitApproval(item.id, "approve")}
              >
                Approve
              </button>
              <button
                className="secondary"
                type="button"
                disabled={approvalBusyId === item.id}
                onClick={() => onSubmitApproval(item.id, "session")}
              >
                Session
              </button>
              <button
                className="danger"
                type="button"
                disabled={approvalBusyId === item.id}
                onClick={() => onSubmitApproval(item.id, "deny")}
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

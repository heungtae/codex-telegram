import { useCallback, useState } from "react";

export function normalizeApprovalItems(items) {
  const rows = Array.isArray(items) ? items : [];
  const filtered = rows.filter((item) => item && typeof item.id === "number");
  return filtered.length ? [filtered[filtered.length - 1]] : [];
}

export function canSubmitApproval(requestId, decision, approvalBusyId) {
  return typeof requestId === "number" && !!decision && approvalBusyId === null;
}

export default function useApprovalFlow({ api }) {
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalBusyId, setApprovalBusyId] = useState(null);

  const loadApprovals = useCallback(async () => {
    const result = await api("/api/approvals");
    setApprovalItems(normalizeApprovalItems(result.items));
  }, [api]);

  const submitApproval = useCallback(async (requestId, decision) => {
    if (!canSubmitApproval(requestId, decision, approvalBusyId)) {
      return;
    }
    setApprovalBusyId(requestId);
    try {
      await api(`/api/approvals/${requestId}`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setApprovalItems((prev) => prev.filter((item) => item.id !== requestId));
    } finally {
      setApprovalBusyId(null);
    }
  }, [api, approvalBusyId]);

  return {
    approvalItems,
    approvalBusyId,
    setApprovalItems,
    setApprovalBusyId,
    loadApprovals,
    submitApproval,
  };
}

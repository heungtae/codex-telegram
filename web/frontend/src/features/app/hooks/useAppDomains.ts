import useApprovalFlow from "../../approvals/hooks/useApprovalFlow";
import { api } from "../../common/api";
import { readTurnNotificationEnabled } from "../../common/theme";
import useSessionDomain from "./useSessionDomain";
import useThreadsDomain from "./useThreadsDomain";
import useUiDomain from "./useUiDomain";

const MOBILE_BREAKPOINT = 900;
const WORKSPACE_PANEL_BREAKPOINT = 1200;

type DomainGroups<
  TThreads extends object,
  TSession extends object,
  TUi extends object,
  TApprovals extends object,
> = {
  threads: TThreads;
  session: TSession;
  ui: TUi;
  approvals: TApprovals;
};

export function buildAppDomains<
  TThreads extends object,
  TSession extends object,
  TUi extends object,
  TApprovals extends object,
>({
  threads,
  session,
  ui,
  approvals,
}: DomainGroups<TThreads, TSession, TUi, TApprovals>) {
  return { threads, session, ui, approvals };
}

export default function useAppDomains() {
  const threads = useThreadsDomain();
  const session = useSessionDomain();
  const ui = useUiDomain({
    mobileBreakpoint: MOBILE_BREAKPOINT,
    workspacePanelBreakpoint: WORKSPACE_PANEL_BREAKPOINT,
    readTurnNotificationEnabled,
  });
  const approvals = useApprovalFlow({ api });

  return buildAppDomains({ threads, session, ui, approvals });
}

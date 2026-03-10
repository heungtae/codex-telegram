# 결과 검증 verifier agent 설계

## 문제 정의
- 목적:
  `default` agent가 생성한 결과물을 별도 verifier agent가 검증하고, 요구사항을 충족하지 못하면 피드백을 바탕으로 재생성하도록 만드는 기능을 추가한다.
- 범위:
  Telegram/Web 공통 turn 처리 흐름, verifier 전용 설정, UI 노출, 런타임 상태 관리, 재시도 정책, 테스트 보강을 포함한다.
- 성공 기준:
  `validation.reviewer.enabled = false`일 때는 기존과 동일하게 `default`만 동작한다.
  `validation.reviewer.enabled = true`일 때는 `default` 결과가 verifier를 통과해야 최종 응답으로 사용자에게 노출된다.
  verifier가 실패를 반환하면 설정된 최대 횟수 내에서 재생성한다.
  최대 검증 횟수 이전이라도 verifier가 통과하면 즉시 종료한다.
  최대 검증 횟수까지 통과하지 못하면 마지막 결과를 최종 응답으로 보내고 검증 한도 도달 사실만 짧게 덧붙인다.

## 요구사항 구조화
- 기능 요구사항:
  새 설정 섹션 `validation.reviewer`를 추가한다.
  설정 항목은 최소 `enabled`, `max_attempts`, `timeout_seconds`, `recent_turn_pairs`를 제공한다.
  verifier는 현재 사용자 입력, 최근 대화 문맥, 이번 candidate 결과를 함께 보고 pass/fail을 판단한다.
  verifier가 fail이면 동일 thread에서 verifier 피드백을 반영하는 후속 turn을 시작한다.
  verifier가 pass이면 더 이상 재시도하지 않고 현재 결과를 최종 응답으로 확정한다.
  Telegram Settings에 guardian과 별도 verifier 패널을 추가한다.
  Web session summary의 enabled agents 목록에 `reviewer`를 추가한다.
- 비기능 요구사항:
  verifier 비활성 시 현재 동작과 이벤트 흐름을 깨지 않아야 한다.
  verifier 전용 app-server client는 guardian과 마찬가지로 사용자 대화 thread와 분리된 세션을 사용해야 한다.
  JSON 기반의 엄격한 verifier 응답 계약을 사용해 파싱 실패를 줄여야 한다.
  interrupt, turn failure, retry exhaustion 시 상태 누수가 없어야 한다.
- 우선순위:
  1. runtime orchestration과 설정 추가
  2. verifier service 및 재시도 prompt 설계
  3. Telegram/Web UI 반영
  4. 문서 및 테스트 보강

## 제약 조건
- 일정/리소스:
  기존 구조를 최대한 재사용해 구현 범위를 통제한다. guardian과 유사한 lifecycle 패턴을 복제하되 책임은 분리한다.
- 기술 스택/환경:
  Python 기반 Telegram bot, FastAPI Web UI, Codex app-server JSON-RPC 구조를 유지한다.
  설정 파일은 사용자 홈의 `~/.config/codex-telegram/conf.toml`을 사용한다.
- 기타:
  verifier 활성 시 초안은 사용자에게 즉시 노출하지 않고 내부 버퍼에 보관한다.
  검증 범위는 현재 요청만이 아니라 최근 대화 문맥을 포함한다.
  설정 UI는 guardian 패널 확장이 아니라 별도 패널로 분리한다.

## 아키텍처/설계 방향
- 핵심 설계:
  `codex/approval_guardian.py`와 병렬되는 `codex/result_verifier.py` 계층을 추가한다.
  verifier는 dedicated CodexClient를 통해 JSON-only 응답을 생성하며, 출력 계약은 `decision`, `summary`, `feedback`, `missing_requirements`를 기본으로 한다.
  main runtime에 turn validation orchestrator를 추가해 verifier enabled 여부에 따라 두 모드로 동작한다.
  disabled 모드에서는 현재처럼 `item/agentMessage/delta`를 즉시 Telegram/Web UI로 forwarding한다.
  enabled 모드에서는 active user turn의 delta를 메모리 버퍼에 적재하고, `turn/completed` 시 verifier를 실행한다.
  verifier가 pass이면 버퍼링된 결과를 한 번만 publish하고 turn을 종료한다.
  verifier가 fail이면 현재 candidate, 최근 문맥, 원래 사용자 요청, verifier 피드백을 포함한 regeneration prompt로 동일 thread에서 새 `turn/start`를 호출한다.
  재시도 attempt는 최초 생성 결과를 1회차로 계산한다.
  retry exhaustion 시 마지막 candidate를 publish하고 짧은 system note를 추가한다.
- 대안 및 trade-off:
  초안을 즉시 보여주고 이후 수정본을 덧붙이는 방식은 구현은 단순하지만, 사용자가 실패한 초안을 먼저 보게 되어 UX가 흔들린다. 이번 설계에서는 최종본만 노출하는 방향을 채택한다.
  verifier 설정을 guardian 하위에 넣는 방식은 UI가 단순하지만 책임이 섞인다. approval 검토와 결과 검증은 역할이 다르므로 `validation.reviewer` 독립 섹션으로 분리한다.
  Web/Telegram 모두 현재는 streaming delta 중심이므로 verifier enabled 시에는 “Verifying draft…” 같은 lightweight progress만 보내고 실제 assistant 본문은 최종 확정 시점에만 publish한다.
- 리스크:
  내부 retry turn도 동일 wildcard event stream에 섞여 들어오므로, user-visible turn과 internal retry turn을 구분하는 상태 설계가 필요하다.
  verifier timeout 또는 invalid JSON 시 전체 응답이 막히지 않도록 fail-open 정책을 둬야 한다.
  turn interrupt, project switch, resume 중 verifier session이 남아 있으면 후속 이벤트가 잘못 매핑될 수 있으므로 상태 정리가 중요하다.

## 작업 계획
1. 설정 모델 확장
   `utils/config.py`, `conf.toml.example`, README에 `validation.reviewer` 기본값과 normalize/save/read 로직을 추가한다.
2. verifier service 추가
   guardian 패턴을 참고해 dedicated client 기반 verifier service를 구현하고 JSON 응답 파서, fallback thread read, timeout 처리를 넣는다.
3. turn orchestration 추가
   `main.py`와 runtime state에 verifier session 상태를 추가하고, enabled 시 delta buffering, verifier 호출, retry prompt 생성, exhaustion 처리, interrupt cleanup을 구현한다.
4. UI/상태 노출 확장
   Telegram Settings 메뉴에 verifier 전용 항목과 패널을 추가하고, Web session summary `agents`에 `reviewer` 상태를 노출한다.
5. 테스트 보강
   config defaults/save, verifier parser/service, runtime retry flow, disabled compatibility, Telegram callback/UI, Web session summary를 검증하는 테스트를 추가한다.
6. 문서 정리
   `docs/DESIGN.md`와 README의 agent/config 설명에 verifier 계층과 동작 차이를 반영한다.


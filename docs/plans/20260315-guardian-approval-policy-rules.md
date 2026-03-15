# Guardian Approval Policy Rules

## 문제 정의
- 목적: Guardian approval 정책을 텍스트 기반 허용/차단 예시 수준에서 확장해, 파일/디렉터리 가드, 명령 가드, 변경 규모 가드, 품질 가드를 실제 rule schema와 runtime evaluator로 지원한다.
- 범위: 기존 설계 문서를 전체 교체하고, `manual_fallback` action, typed condition schema, context detector, approval 흐름, UI/API summary, 예제 설정, 테스트 전략을 포함한다.
- 성공 기준: 사용자는 TOML rule만으로 `pom.xml`, `Dockerfile`, `helm/`, `db/migration/`, 비밀정보 파일, 위험 명령, 대규모 변경, 공개 API/DB/auth-security 변경, lint/test/coverage 조건을 Guardian approval 정책에 반영할 수 있어야 한다.

## 요구사항 구조화
- 기능 요구사항:
  - 기존 text rule(`match_method`, `match_question_any`, `match_reason_any`, `match_option_any`)는 유지한다.
  - 새 rule action `manual_fallback`을 지원해 “human approval 필요”를 per-rule로 표현할 수 있어야 한다.
  - 새 typed condition을 지원해야 한다.
    - `command_any`, `command_regex`
    - `path_any`, `path_prefix_any`, `path_glob_any`
    - `secret_path_any`, `secret_path_glob_any`
    - `max_changed_files`
    - `require_public_api_change`
    - `require_db_schema_change`
    - `require_auth_security_change`
    - `require_lint_failed`
    - `require_unit_test_failed`
    - `coverage_drop_gt`
  - approval context는 payload text 외에 command/path/change/quality metadata와 workspace git status를 best-effort로 수집해야 한다.
  - 매칭된 rule이 `approve/session/deny`이면 자동 결정을 제출해야 한다.
  - 매칭된 rule이 `manual_fallback`이면 Guardian LLM review를 건너뛰고 human approval UI로 넘겨야 한다.
  - rule 미매칭 시 기존 Guardian LLM review를 유지해야 한다.
- 비기능 요구사항:
  - 기존 config와 하위 `llm` 섹션을 깨지 않아야 한다.
  - invalid rule은 안전하게 skip 되어야 한다.
  - 로그와 UI summary에서 어떤 rule/action이 활성화되어 있는지 확인 가능해야 한다.
- 우선순위:
  - 1순위: typed rule schema + runtime evaluator + manual_fallback
  - 2순위: path/command/change/quality detector
  - 3순위: docs/example/UI summary 확장

## 제약 조건
- 일정/리소스: Full rule editor UI는 만들지 않고 TOML 편집을 기준으로 한다.
- 기술 스택/환경: Python bot, Codex app-server approval request, TOML config, local workspace git status를 사용한다.
- 기타:
  - app-server가 모든 metadata를 구조화해 주지 않을 수 있으므로 detector는 payload text와 local workspace 상태를 함께 사용한다.
  - 공개 API/DB schema/auth-security 판단은 v1에서 경로 기반 heuristic을 기본으로 한다.
  - quality signal은 metadata 또는 text 기반 best-effort로 처리한다.

## 아키텍처/설계 방향
- 핵심 설계:
  - `utils.approval_policy.build_approval_policy_context()`가 approval payload, optional workspace path를 입력받아 typed context를 만든다.
  - typed context에는 `command_text`, `touched_paths`, `changed_file_count`, `public_api_changed`, `db_schema_changed`, `auth_security_changed`, `lint_failed`, `unit_test_failed`, `coverage_drop`가 포함된다.
  - `match_approval_policy()`는 priority 순으로 rule을 평가하고 `approve|session|deny|manual_fallback` 중 하나를 반환한다.
  - `main.py` approval 처리부는 rule match 결과가 `manual_fallback`이면 human approval UI로, `approve/session/deny`이면 auto decision으로 처리한다.
  - rule 미매칭일 때만 기존 Guardian LLM review를 호출한다.
- 평가 순서:
  1. secret/path deny rules
  2. dangerous command deny rules
  3. explicit allow rules
  4. large/sensitive change escalation rules
  5. quality escalation/block rules
  6. legacy text rules
  7. Guardian LLM fallback
  8. global `failure_policy`
- 기본 정책 프리셋:
  - 파일/디렉터리 가드:
    - `pom.xml`, `Dockerfile`, `helm/**`, `db/migration/**` -> `manual_fallback`
    - `.env`, `*.pem`, `*.key`, `id_rsa`, `secrets/**`, `credentials/**` -> `deny`
  - 명령 가드:
    - 허용: `mvn -q test`, `mvn -q -DskipTests compile`, `./gradlew test`, `git diff`, `git status`
    - 차단: `rm -rf`, `curl | sh`, package install, 임의 네트워크 호출
  - 변경 규모 가드:
    - changed file count `> 20` -> `manual_fallback`
    - 공개 API 변경, DB schema 변경, auth/security 변경 -> `manual_fallback`
  - 품질 가드:
    - lint 실패 + merge candidate 관련 명령 -> `deny`
    - coverage 감소폭 threshold 초과 -> `manual_fallback`
- 리스크:
  - path/quality detector는 heuristic 기반이라 false negative 가능성이 있다.
  - git status 기반 changed file count는 approval 시점 workspace 상태를 반영하며, pending action 자체를 완벽히 설명하지는 못한다.
  - rule이 너무 광범위하면 `manual_fallback` 비율이 과도하게 올라갈 수 있다.

## 작업 계획
1. 기존 설계 문서를 확장 설계로 교체한다.
2. `utils.approval_policy.py`에 typed context builder와 rule evaluator를 구현한다.
3. `utils.config.py`에 새 action/typed field normalize, summary, serialization을 추가한다.
4. `main.py` approval 흐름에 `manual_fallback` semantics와 typed policy evaluation을 통합한다.
5. Guardian panel/Web summary에 action counts와 matched policy 표시를 추가한다.
6. `conf.toml.example`, `README.md`, `docs/DESIGN.md`에 새 rule schema와 예제 정책을 반영한다.
7. config parsing, path/command guards, change-scale guard, quality guard, fallback flow에 대한 테스트를 추가하고 실행한다.

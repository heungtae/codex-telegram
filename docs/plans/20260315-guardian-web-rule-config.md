# Guardian Web Rule Config Plan

## 문제 정의
- 목적: Web UI에서 Guardian rule을 `conf.toml`과 동일한 TOML block format으로 직접 편집하고 저장할 수 있게 해, Web과 파일 편집 경험을 일치시킨다.
- 범위: Guardian Web 설정 UI, Guardian config API, server-side validation/save 로직, raw TOML 편집 UX를 포함한다. Telegram UI는 이번 범위에서 제외한다.
- 성공 기준: 사용자가 Web UI의 TOML textarea에서 `[[approval.guardian.rules]]` block을 수정하고 저장하면 `conf.toml`에 반영되어야 한다. `conf.toml`에 rule이 없을 때는 `conf.toml.example` rule을 주석 example로만 보여주고, 실제 활성 rule count는 `conf.toml` 기준으로 계산되어야 한다.

## 요구사항 구조화
- 기능 요구사항:
  - Web에서 현재 Guardian rules 전체를 `conf.toml`과 같은 TOML block 형태로 보여줘야 한다.
  - 사용자는 raw TOML textarea에서 rules를 직접 수정할 수 있어야 한다.
  - 저장 전 TOML parse/validation 에러를 사용자에게 보여줘야 한다.
  - server-side validation 에러를 그대로 사용자에게 보여줘야 한다.
  - Guardian 기본 설정(`timeout`, `failure_policy`, `explainability`)은 기존 UI처럼 유지해야 한다.
  - rule summary는 기존처럼 상단에 유지해야 한다.
  - `conf.toml`에 Guardian rule이 없으면 `conf.toml.example` rule을 주석 example로 보여줘야 한다.
- 비기능 요구사항:
  - 기존 TOML 구조와 `approval.guardian.llm` 보존 동작을 깨지 않아야 한다.
  - invalid rule은 저장 전에 차단하고, 에러는 rule-level 메시지로 표시해야 한다.
  - typed schema가 늘어나도 프론트 수정량이 최소화되어야 한다.
- 우선순위:
  - 1순위: read/edit/save 가능한 raw TOML editor
  - 2순위: client/server validation
  - 3순위: helper text와 summary 보강

## 제약 조건
- 일정/리소스: 현재 Web 설정 UI는 scalar select field만 처리하는 generic form 구조라, structured rule builder를 추가하면 구현량이 커진다.
- 기술 스택/환경: React 단일 페이지, FastAPI endpoint, TOML config 저장 로직을 사용한다.
- 기타:
  - rule schema가 계속 확장 중이므로 raw TOML 편집이 확장 대응에 가장 유리하다.
  - rule 내부 matcher 그룹은 `AND` semantics라, UI helper text로 이를 명확히 설명해야 한다.
  - 운영자는 Web에서 본 내용을 그대로 `conf.toml`에 복사해도 형식 차이가 없어야 한다.

## 아키텍처/설계 방향
- 핵심 설계:
  - Guardian 기본 설정 form은 그대로 유지하고, `Rules TOML` textarea를 별도 필드로 추가한다.
  - backend는 Guardian config 전체를 한 번에 읽고 저장하는 API를 제공한다.
    - `GET /api/guardian`은 기존처럼 전체 Guardian config를 반환하되 `rules`, `rules_toml`을 함께 포함한다.
    - `POST /api/guardian`은 기존 scalar 필드뿐 아니라 optional `rules_toml`도 받을 수 있게 확장한다.
  - `utils.config.save_guardian_settings(..., rules_toml=...)`를 추가해 TOML block을 rules로 파싱한 뒤 저장한다.
  - `conf.toml.example`의 default rule set은 editor example 용도로만 사용하고, 활성 rule로 자동 보강하지 않는다.
  - Web UI는 `guardian`에 대해서만 custom renderer를 두고 다음 순서로 렌더링한다.
    - 상단: 기존 scalar settings
    - 중단: rules summary
    - 하단: raw TOML textarea
  - 저장 흐름:
    - 클라이언트는 raw TOML 문자열을 그대로 전송
    - 서버에서 TOML parse + typed validation
    - comments-only example은 빈 rules로 처리
    - 정상 저장 후 normalized TOML을 다시 textarea에 반영
- 구현 방식 선택:
  - raw TOML editor를 채택한다.
  - 이유: 실제 `conf.toml` 포맷과 동일해 운영자가 복사/이동하기 쉽고, 주석과 example을 자연스럽게 포함할 수 있기 때문이다.
- 리스크:
  - 사용자가 schema를 직접 알아야 한다.
  - 구조화된 editor보다 오타 가능성이 높다.
  - validation 메시지가 충분히 명확하지 않으면 UX가 거칠 수 있다.

## 작업 계획
1. backend 저장 API를 확장해 `rules_toml` 입력과 validation 에러 응답을 지원한다.
2. `utils.config` 저장 로직을 확장해 scalar + TOML rules를 함께 저장하고 `llm` section을 계속 보존한다.
3. `conf.toml.example`의 Guardian default rule set을 읽어, `conf.toml`에 rule이 없을 때 주석 example으로만 보여준다.
4. Web에서 Guardian 전용 `Rules TOML` textarea를 추가한다.
5. 저장 성공 후 normalized rules TOML을 다시 editor에 반영한다.
6. README와 예제 설정에 “Web에서 conf.toml 형식으로 rule을 편집할 수 있음”과 AND semantics를 반영한다.
7. 테스트를 추가한다.
   - config save with rules/rules_toml
   - guardian API accepts rules_toml
   - commented example rendering when no configured rules exist
   - invalid rule validation

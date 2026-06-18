# Web UI Kit

## Purpose

Use the UI Kit for reusable controls that appear across feature components. Keep feature-specific layout classes close to their feature, and use UI Kit classes for the shared control behavior and visual baseline.

## Components

- `Button`: modal and form actions. Use `primary`, `secondary`, or `ghost`.
- `IconButton`: icon-only actions with required accessible labels.
- `Input`: plain text inputs such as search fields.
- `Select`: native option selection with shared input styling.
- `FormField`: wrapper label, control, and optional help text composition.
- `Modal`: shared backdrop and accessible dialog shell.
- `Textarea`: multi-line text inputs such as the composer.
- `Badge`: compact labels and status markers.
- `Panel`: shared sidebar section containers.
- `Toast`: accessible `info`, `success`, and `error` notifications.
- `EmptyState`: static empty or informational messages with `default` and `notice` tones.

## Usage Rules

- Prefer UI Kit components for new shared controls instead of raw `button`, `input`, or `textarea`.
- Keep option creation and value conversion feature-owned when using `Select`.
- Use `FormField` for vertically stacked labels and controls; keep validation and control state feature-owned.
- Use `IconButton` for controls whose visible content is only an icon.
- Keep existing feature classes when they describe layout or domain-specific state.
- Keep Composer mode and slash palette keyboard behavior feature-owned unless that behavior is explicitly in scope.
- Keep feature-owned panel layouts such as Workspace and Preview panels outside the generic `Panel`.
- Keep Toast state and dismissal timing outside the presentational `Toast`.
- Use `EmptyState` for empty collections and passive notices; keep loading and error states feature-owned.
- Keep API, SSE, session, and keyboard behavior unchanged when replacing markup.

## Next Candidates

- Expand adoption only when another control has repeated markup and stable behavior.

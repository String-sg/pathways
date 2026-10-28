# Validation Guide

## Inspect this planning/placeholder PR

Requirements: Python 3 and a modern browser. There is no application install/build step.
From the repository root:

```sh
python3 -m http.server 18765 --bind 127.0.0.1
git diff --check
```

Open `http://127.0.0.1:18765/`. Check the Pathways current entry and the unavailable
Atlas entry at 320, 375 and 1440 CSS-pixel widths. Tab through the page: Atlas must not
be a focusable control. Try an existing subject preset and open its result; use the
reverse-planning control to confirm the existing journey is still present. Keep test
inputs fictional. Stop the local server when finished.

Compare the inline scripts with the base revision to verify that the placeholder
has not modified admissions evaluation, local saving or comparison behaviour.
See [test-matrix.md](test-matrix.md) for recorded scope and evidence.

## Future implementation checks

The remaining task list is a plan, not a test suite. Once implemented, automate
reviewed rule fixtures and the high-value browser scenarios from the matrix. Preserve
Atlas's documented engine/matcher/parity commands when shared rules are actually
changed; no Atlas test result is claimed by this PR.

For local saving, export a partial and complete plan and summary; inspect PDF output;
import in a fresh browser context; test invalid size/schema/profile/rules versions,
cancelled replacement and storage-disabled operation. Use the file contract rather
than creating server records.

For mobile release, test the complete journey in iOS Safari and Android Chrome,
including the on-screen keyboard, Back, landscape, 200% text, long explanations and
comparison. Browser resizing alone is not physical-device verification.

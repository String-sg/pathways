# Pathways

Educators building tools to help students make sense of subject choices and post-secondary pathways in Singapore.

This repository brings together vibe-coded prototypes: tools built with AI assistance, shaped by educators' experience of the questions students ask. The collection now includes Pathways and Student Pathway Atlas. The first release prioritises Pathways for parents and young people planning subject choices; Atlas is greyed out as **Coming soon** in the shared entry while its original prototype remains in this repository. Shared benchmarking and Pathways journey tests are planned.

The exercise is also about giving people credit. Each prototype should retain its creator's name, its origins, and the contributions it builds on.

## The people behind this

**Evan, Tiannuo, and Mathew are all educators and contributors to this exercise.**

The current prototype's in-app acknowledgements credit:

- **Evan Liao** with the Secondary 2 adaptation, reverse planning, subject combination features, nursing progression guide, glossary, and interface.
- **Mathew Lim** with the original Post-Secondary Pathway Explorer prototype, core evaluation model, grade mapping, and baseline admissions data.

**Koo Tiannuo** created **Student Pathway Atlas**, the results and course-matching prototype in [`student-pathway-atlas/`](student-pathway-atlas/). Its original README, licence, offline artifact and tests remain identifiable.

Please preserve these acknowledgements when adapting the work. As prototypes, tests, and improvements are added, record who contributed what, including ideas or earlier work that a prototype builds on.

## What is here today?

| Item | Status |
| --- | --- |
| Pathway Explorer in [index.html](index.html) | Available |
| Student Pathway Atlas in [`student-pathway-atlas/`](student-pathway-atlas/) | Prototype retained; Coming soon in the shared entry |
| Shared admissions-reference comparison | Planned after scope and independently reviewed cases are agreed |
| Shared Pathways journey/rule tests | Planned; Atlas already includes its own engine, matcher and browser checks |
| Pathways export/import and summary PDF | Specified for review; not implemented |

The current explorer lets users select subjects, subject levels (G1, G2, or G3), and results to explore possible post-secondary pathways. It also includes destination-first planning, course comparisons, and a glossary. Its interface is labelled for the Singapore–Cambridge Secondary Education Certificate (SEC) 2028 framework.

These are prototypes for exploration and discussion. Check current official admissions requirements before using an output to guide an actual subject or course decision.

## Pathways-first planning

Start with [user journeys](docs/pathways-journeys.md), the [prioritised UX backlog](docs/pathways-ux-backlog.md),
and the [feature specification](specs/001-pathways-first/spec.md). The [implementation plan](specs/001-pathways-first/plan.md),
[task list](specs/001-pathways-first/tasks.md) and [test/evidence matrix](specs/001-pathways-first/test-matrix.md)
separate the delivered placeholder from proposed mobile, rule-review and export work.

The intended saving flow uses local summary/plan export and plan import, without login
or a database. Hosted GA4 is deferred to a separate measurement slice; no analytics is
activated by this planning change. Preserve the telemetry-free Atlas offline artifact.

Spec Kit is initialised with a proposed [project constitution](.specify/memory/constitution.md).
Contributor workflows are in `.agents/skills/speckit-*`; tool-version provenance is in
[research.md](specs/001-pathways-first/research.md). Review the spec → plan → tasks before
implementing the remaining work. There is no Spec Kit requirement for people using the app.

## Try the current prototype

1. Download this repository using **Code → Download ZIP** and unzip it, or clone it.
2. Keep `index.html`, `background.png`, and `logo.png` together in the same folder.
3. Open `index.html` in a modern web browser.

There is no installation or build step. Google Fonts are loaded online. The app uses the browser's local storage to save subject selections.

## Adding your prototype

Please submit each additional prototype in its own clearly named folder so the versions can be tried side by side. Include a short README with:

- Your name and the people or earlier work to credit.
- Who the tool is for and what it helps them do.
- How to open or run it, including any dependencies.
- The admissions year, sources, and assumptions it uses.
- Known gaps and a few example inputs to try.

Keep the original prototype identifiable when making improvements. Use made-up student examples for demos and tests.

## How we will compare them

Before comparing the prototypes, agree on their overlapping scope and a small set of independently reviewed scenarios. Run each tool through the same supported cases and document differences between simplified planning and detailed results calculation.

The proposed comparison will look at:

- **Accuracy:** Do outputs match the agreed reference requirements?
- **Clarity:** Can a student or educator understand the result and its explanation?
- **Edge cases:** What happens with missing inputs, mixed subject levels, or results near a requirement boundary?
- **Ease of use:** Can someone complete the main task on desktop and mobile?

We will record the prototype version, inputs, expected result, actual result, and observations in this repository. Differences in intended audience or supported features should be made explicit so the comparison is fair.

The aim is to learn from each approach and recognise each educator's contribution. Benchmark findings describe the prototypes under the tested conditions.

## Scripted tests: the next step

After agreeing on the scenarios and checking their expected outcomes against official sources, we will turn repeatable checks into scripted tests in this same repository. These should cover pathway rules and key browser interactions, with instructions for running them and recorded results.

No shared benchmark results or new Pathways automated coverage are claimed here. Atlas documents its own existing tests; this planning change does not independently rerun or certify them.


# Pathways

Educators building tools to help students make sense of subject choices and post-secondary pathways in Singapore.

This repository brings together vibe-coded prototypes: tools built with AI assistance, shaped by educators' experience of the questions students ask. We are starting with one prototype, expecting two more, and will then run a small benchmarking exercise and add shared scripted tests here.

The exercise is also about giving people credit. Each prototype should retain its creator's name, its origins, and the contributions it builds on.

## The people behind this

**Evan, Tiannuo, and Mathew are all educators and contributors to this exercise.**

The current prototype's in-app acknowledgements credit:

- **Evan Liao** with the Secondary 2 adaptation, reverse planning, subject combination features, nursing progression guide, glossary, and interface.
- **Mathew Lim** with the original Post-Secondary Pathway Explorer prototype, core evaluation model, grade mapping, and baseline admissions data.

**Tiannuo** is a fellow educator contributing to this exercise. Details of individual submissions will be added as the remaining prototypes arrive.

Please preserve these acknowledgements when adapting the work. As prototypes, tests, and improvements are added, record who contributed what, including ideas or earlier work that a prototype builds on.

## What is here today?

| Item | Status |
| --- | --- |
| Pathway Explorer in [index.html](index.html) | Available |
| Two more educator-built prototypes | Expected |
| Mini benchmarking exercise | Planned, once the prototypes are collected |
| Shared scripted tests | Planned; no test suite is included yet |

The current explorer lets users select subjects, subject levels (G1, G2, or G3), and results to explore possible post-secondary pathways. It also includes destination-first planning, course comparisons, and a glossary. Its interface is labelled for the Singapore–Cambridge Secondary Education Certificate (SEC) 2028 framework.

These are prototypes for exploration and discussion. Check current official admissions requirements before using an output to guide an actual subject or course decision.

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

Once all three prototypes are here, we will agree on a small set of shared scenarios and run each tool through the same cases.

The proposed comparison will look at:

- **Accuracy:** Do outputs match the agreed reference requirements?
- **Clarity:** Can a student or educator understand the result and its explanation?
- **Edge cases:** What happens with missing inputs, mixed subject levels, or results near a requirement boundary?
- **Ease of use:** Can someone complete the main task on desktop and mobile?

We will record the prototype version, inputs, expected result, actual result, and observations in this repository. Differences in intended audience or supported features should be made explicit so the comparison is fair.

The aim is to learn from each approach and recognise each educator's contribution. Benchmark findings describe the prototypes under the tested conditions.

## Scripted tests: the next step

After agreeing on the scenarios and checking their expected outcomes against official sources, we will turn repeatable checks into scripted tests in this same repository. These should cover pathway rules and key browser interactions, with instructions for running them and recorded results.

No benchmark results or automated test coverage are claimed yet.


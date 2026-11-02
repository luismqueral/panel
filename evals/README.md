# Evals

Tests for the skill, cheapest first (brief, Appendix J).

| Folder | What it is | Run |
| --- | --- | --- |
| `behavior/` | The behavior spec as browser tests, plus fidelity, axe, and 400px checks on every screen. Any build, any flavor | `PANEL_URL=<url> npm run test:behavior`, or `node tools/run-behavior.mjs <dist>` |
| `recipes/` | The verified recipes against the real project server | `npm run test:recipes` |
| `fixtures/` | Reference builds: `vanilla-blog/`, `react-blog/` | `npm run test:behavior`, `npm run test:behavior:react` |
| `harness/` | The experiment protocol: run prompt, preset intake, scorer | below |
| `runs/` | Each experiment's runs, one folder per fresh session | |
| `results/` | Scored reports | |

## Running an experiment

1. Start N fresh sessions. Give each `harness/prompt.md`, with `{{RUN}}` set to `evals/runs/<experiment>/run-<n>`. Sessions must not see each other's output or this repository's answers.
2. Save each session's final reply as `runs/<experiment>/run-<n>/REPORT.md`.
3. Score: `node evals/harness/score.mjs evals/runs/<experiment>`. It writes `results/<experiment>/results.md`, `results.json`, and screenshots.

The scorer, for each run: copies the test seed over the run's `seed.json`, serves the run's `panel/`, runs the behavior suite, checks that every shipped file is unmodified and that every template is inlined unchanged, checks for added dependencies, and snapshots eight views. Across runs, it counts distinct DOM structures and distinct visible copy per view.

A run **conforms** when every test passes, every shipped file is unmodified, it adds no dependencies, and every required file exists. The kill criterion is 80% of runs conforming. The scorer checks the vanilla layout; a React run needs its own required-files list.

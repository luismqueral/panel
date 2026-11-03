# Results: blog-vanilla-3

Scored 2026-11-03 with `node evals/harness/score.mjs evals/runs/blog-vanilla-3`.

**Conformance with unmodified templates: 5 of 5 runs (100%). Kill criterion (80%): passed.**

A run conforms when every behavior and quality test passes, every shipped file (templates, CSS, snippets, adapters, server) is unmodified, it adds no dependencies, and every required file exists, and the login allow list is not in the served config.

| Run | Conforms | Tests | Template fidelity | Unmodified files | No dependencies | Missing files |
| --- | --- | --- | --- | --- | --- | --- |
| run-1 | yes | 67/67 | 20/20 | yes | yes | none |
| run-2 | yes | 67/67 | 20/20 | yes | yes | none |
| run-3 | yes | 67/67 | 20/20 | yes | yes | none |
| run-4 | yes | 67/67 | 20/20 | yes | yes | none |
| run-5 | yes | 67/67 | 20/20 | yes | yes | none |

## Consistency across runs

Distinct versions of each view across the runs. 1 means every run produced the same thing. Structure is the DOM as the fidelity check normalizes it (slot contents blank); copy is the visible text.

| View | Structures | Copies |
| --- | --- | --- |
| home | 1 | 1 |
| collection | 2 | 1 |
| item | 1 | 1 |
| item-published | 1 | 1 |
| singleton | 1 | 1 |
| not-found | 1 | 1 |
| create | 1 | 1 |
| confirm-delete | 1 | 1 |

## Failed tests

None.

## Copy differences

None.

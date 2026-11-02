# Results: blog-vanilla-2

Scored 2026-11-02 with `node evals/harness/score.mjs evals/runs/blog-vanilla-2`.

**Conformance with unmodified templates: 5 of 5 runs (100%). Kill criterion (80%): passed.**

A run conforms when every behavior and quality test passes, every shipped file (templates, CSS, snippets, adapters, server) is unmodified, it adds no dependencies, and every required file exists, and the login allow list is not in the served config.

| Run | Conforms | Tests | Template fidelity | Unmodified files | No dependencies | Missing files |
| --- | --- | --- | --- | --- | --- | --- |
| run-1 | yes | 64/64 | 20/20 | yes | yes | none |
| run-2 | yes | 64/64 | 20/20 | yes | yes | none |
| run-3 | yes | 64/64 | 20/20 | yes | yes | none |
| run-4 | yes | 64/64 | 20/20 | yes | yes | none |
| run-5 | yes | 64/64 | 20/20 | yes | yes | none |

## Consistency across runs

Distinct versions of each view across the runs. 1 means every run produced the same thing. Structure is the DOM as the fidelity check normalizes it (slot contents blank); copy is the visible text.

| View | Structures | Copies |
| --- | --- | --- |
| home | 2 | 1 |
| collection | 3 | 1 |
| item | 2 | 1 |
| item-published | 2 | 1 |
| singleton | 2 | 1 |
| not-found | 3 | 1 |
| create | 3 | 1 |
| confirm-delete | 2 | 1 |

## Failed tests

None.

## Copy differences

None.

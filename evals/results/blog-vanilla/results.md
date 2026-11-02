# Results: blog-vanilla

Scored 2026-11-02 with `node evals/harness/score.mjs evals/runs/blog-vanilla`.

**Conformance with unmodified templates: 0 of 5 runs (0%). Kill criterion (80%): failed.**

A run conforms when every behavior and quality test passes, every shipped file (templates, CSS, snippets, adapters, server) is unmodified, it adds no dependencies, and every required file exists.

| Run | Conforms | Tests | Template fidelity | Unmodified files | No dependencies | Missing files |
| --- | --- | --- | --- | --- | --- | --- |
| run-1 | no | 59/60 | 20/20 | yes | yes | none |
| run-2 | no | 58/60 | 20/20 | yes | yes | none |
| run-3 | no | 59/60 | 20/20 | yes | yes | none |
| run-4 | no | 59/60 | 20/20 | yes | yes | none |
| run-5 | no | 58/60 | 20/20 | yes | yes | none |

## Consistency across runs

Distinct versions of each view across the runs. 1 means every run produced the same thing. Structure is the DOM as the fidelity check normalizes it (slot contents blank); copy is the visible text.

| View | Structures | Copies |
| --- | --- | --- |
| home | 2 | 1 |
| collection | 2 | 1 |
| item | 2 | 1 |
| item-published | 2 | 1 |
| singleton | 2 | 1 |
| not-found | 2 | 1 |
| create | 2 | 1 |
| confirm-delete | 2 | 1 |

## Failed tests

### run-1

- collections show the empty state with a create action: Error: expect(locator).toHaveAttribute(expected) failed

### run-2

- K6 the skip link focuses the main region and keeps the screen: Error: expect(page).toHaveURL(expected) failed
- collections show the empty state with a create action: Error: expect(locator).toHaveAttribute(expected) failed

### run-3

- collections show the empty state with a create action: Error: expect(locator).toHaveAttribute(expected) failed

### run-4

- K6 the skip link focuses the main region and keeps the screen: Error: expect(page).toHaveURL(expected) failed

### run-5

- K6 the skip link focuses the main region and keeps the screen: Error: expect(page).toHaveURL(expected) failed
- collections show the empty state with a create action: Error: expect(locator).toHaveAttribute(expected) failed

## Copy differences

None.

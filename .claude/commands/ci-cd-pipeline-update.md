---
name: ci-cd-pipeline-update
description: Workflow command scaffold for ci-cd-pipeline-update in token-tracker.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /ci-cd-pipeline-update

Use this workflow when working on **ci-cd-pipeline-update** in `token-tracker`.

## Goal

Update or fix the CI/CD pipeline, including lint, test, build, and release workflows.

## Common Files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit .github/workflows/ci.yml and/or .github/workflows/release.yml to add or fix jobs, dependencies, or steps.
- Optionally update related configuration files (e.g., package.json, pnpm-lock.yaml) if needed for the pipeline.
- Commit with a message referencing CI, release, or workflow.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
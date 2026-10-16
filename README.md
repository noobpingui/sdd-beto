# sdd-beto

**English** · [Español](README.es.md)

A Claude Code plugin that installs a **Spec-Driven Development (SDD)** production line in any repository:

```
spec → plan → tasks → tests (red) → implement → verify → review → docs → close
```

Each stage is run by a specialized subagent with its own permissions. The main session orchestrates, and **you approve at three gates: the spec, the review and the close** (which covers push, PR and merge in one go). In between, the flow only stops for major decisions; minor ones are logged in a backlog. A `strict` mode keeps a gate at every stage, commit and push. Hooks stop an agent from writing outside its role and stop production code from being touched without an approved spec and plan.

> **Language:** the agent and skill prompts, and the documentation under `docs/`, are in Spanish. The artifacts each project generates (`spec.md`, `plan.md`, reports) and the orchestrator's messages follow the `language` set in that project's `.sdd/config.json`, so an English project gets English artifacts.

## What you get
- **Traceable specs:** user story, requirements in EARS format and Given/When/Then acceptance criteria. Every criterion ends up in a test carrying the `SDD:` marker.
- **Real TDD:** tests are written before the code, and a `verifier` checks that they fail for the right reason (red check) before implementation starts.
- **Independent review:** a `reviewer` that uses the project's constitution as its checklist, with a fix loop capped by an iteration limit.
- **Up-to-date documentation:** a `doc-keeper` updates the affected documentation and the Project section of `CLAUDE.md`.
- **A flow that doesn't stall:** three human gates by default, automatic local commits in between and a backlog where minor decisions are logged instead of interrupting you.
- **Generic:** paths, commands, scopes (monorepos included) and conventions live in each project's `.sdd/config.json` and constitution, which `/sdd-beto:init` generates.

## Requirements
- A recent [Claude Code](https://code.claude.com/docs).
- Node.js ≥ 20 (the plugin's scripts have no dependencies).
- A git repository. The scripts are plain Node and tolerate CRLF; tested on Windows 11 and designed for macOS and Linux too.

## Installation
```
claude plugin marketplace add https://github.com/noobpingui/sdd-beto.git
claude plugin install sdd-beto@sdd-beto
```
The short form `noobpingui/sdd-beto` works too: Claude Code clones over SSH if you have a key that authenticates to GitHub, and over HTTPS otherwise. The plugin is installed for your user, but **it does nothing in a project without `.sdd/config.json`**.

## Quick start
At the project root, inside Claude Code:

1. **`/sdd-beto:init`**: analyzes the repo and proposes, step by step and with your approval, the config (including the gate mode), the project constitution and the `CLAUDE.md` sections. In `flow` mode it also offers local permissions so the stage commits don't prompt. It ends with a commit on a `chore/sdd-init` branch.
2. **`/sdd-beto:new <slug> <idea>`**: creates the feature (number, branch and folder). For example: `/sdd-beto:new export-csv Export the monthly report to CSV`.
3. **`/sdd-beto:run`**: walks through the flow. It stops for you to approve the spec, then runs on its own (with a local commit per stage) up to the review, where you get a summary of every stage and the backlog. The close gate pushes, opens the PR and merges it; answer "approved" at each gate.

The [usage guide](docs/guia.md) (in Spanish) explains each step in detail.

## Commands
| Command | What it does |
|---|---|
| `/sdd-beto:init [notes]` | Adopts the flow in the repo or updates it (idempotent) |
| `/sdd-beto:new <slug> <idea>` | Creates a feature: branch `feat/NNN-slug` and folder `<specs>/NNN-slug/` |
| `/sdd-beto:run [NNN-slug]` | Runs the next stage and chains the rest, stopping at the gates of the `gate_mode` |
| `/sdd-beto:status [NNN-slug]` | Feature status and consistency checks (read-only) |
| `/sdd-beto:spec` · `plan` · `tasks` · `test` · `implement` · `verify` · `review` · `docs` · `close` `[NNN-slug]` | Runs a single stage |

All of them are invoked by hand: Claude doesn't launch them on its own.

## How it works
| Stage | Agent | Default model |
|---|---|---|
| spec | `spec-writer` | opus |
| plan | `planner` (and ADRs) | opus |
| tasks | `task-breaker` | sonnet |
| tests | `implementer` (stubs) → `test-author` → `verifier` (red check) | sonnet / sonnet / haiku |
| implement | `implementer` | sonnet |
| verify | `verifier` | haiku |
| review | `reviewer` | opus |
| docs | `doc-keeper` | sonnet |
| close | the main session | your session's model |

- **Artifacts:** each feature lives in `<specs>/NNN-slug/` (`idea.md`, `spec.md`, `plan.md`, `tasks.md`, `verify-report.md`, `review.md`, `docs-report.md`, `backlog.md` and `state.json`). `state.json` is the single source of truth for the state and only the plugin's `sdd-state` CLI changes it.
- **Constitution:** a base part, the same for every project, and a Part II specific to each project (`.sdd/constitution.md`), which can only tighten the base.
- **Hooks:** `role-guard` (each agent writes only to its own paths and in its own stage), `stage-guard` (production code isn't edited without an approved spec and plan) and `git-guard` (subagents only use read-only git).
- **Models:** they can be changed per project with `models` in `.sdd/config.json`.

## Gates and approvals
`gate_mode` in `.sdd/config.json` sets how often the flow stops for you ([ADR-0029](docs/decisions/ADR-0029-gate-mode-flow.md)).

| | `flow` (default) | `strict` |
|---|---|---|
| Gates | spec, review and close | after every stage |
| Stage commits | automatic, local, on the feature branch | approved at each stage's gate |
| Push, PR and merge | one approval at the close gate | each push approved separately |

**With `flow`:**
1. **Spec gate:** you approve what will be built. The spec is committed.
2. **plan → tasks → tests → implement → verify** run on their own, with one local commit per stage and automatic fix loops. Nothing leaves your machine.
3. **Review gate:** a summary of every stage (each agent's decisions, new ADRs, automatic fixes, commits), the reviewer's verdict and the feature backlog. From here you can send any stage back for rework or ask for a backlog item to be fixed now.
4. **docs** runs on its own.
5. **Close gate:** the definition-of-done checklist and, with a single approval, the final commit, the push, the PR (`gh pr create`), its merge as a merge commit (`gh pr merge --merge --delete-branch`) and the return to the base branch. If any step fails, the flow stops there and explains what's left.

Between gates the flow stops **only for a major decision**: changing the approved spec's scope, breaching the constitution, a new dependency, a destructive migration or a broken public API, anything touching security or data, an ambiguity with functionally different outcomes, or the iteration limit. Anything else (naming, style, optional improvements, minor review findings) is decided by the agent and logged.

**Backlog in two levels:** each agent reports what it left pending, and the orchestrator copies it into `<specs>/NNN-slug/backlog.md`. On close, the open items move to the project backlog (`paths.backlog`, `docs/backlog.md` by default), with a link to the feature.

**Permissions:** with `flow`, `/sdd-beto:init` offers to allow `git add` and `git commit` in `.claude/settings.local.json` (personal, not versioned) so the automatic commits don't prompt. It never allows `git push`: depending on your permission mode, Claude Code may still ask before the push and the `gh` commands at close.

### Switching between `flow` and `strict`
Change the mode **between features**: before `/sdd-beto:new` or after a feature is closed, never halfway through one. The mode applies to the whole project, and a feature that changes mode halfway mixes two ways of working (stages already approved automatically stay approved).

1. Go back to the base branch with no feature in progress (`/sdd-beto:status` shows it).
2. Run **`/sdd-beto:init`** and ask for the mode change, for example: `/sdd-beto:init switch to strict mode`. Init enters update mode, proposes only this diff in `.sdd/config.json`:
   ```json
   "gate_mode": "strict"
   ```
   (`"flow"` to go back, or remove the field, since `flow` is the default), regenerates the "Aprobación humana" section of `CLAUDE.md` for the new mode and commits both on its own branch, each step with your approval.
3. Merge that branch into the base branch, and the next `/sdd-beto:new` runs in the new mode.

You can also edit `.sdd/config.json` by hand, but then run `/sdd-beto:init` anyway, or `CLAUDE.md` will keep describing the previous mode's approval rules.

## Updating and uninstalling
```
claude plugin marketplace update sdd-beto
claude plugin update sdd-beto@sdd-beto
claude plugin uninstall sdd-beto@sdd-beto
```
After updating, run `/sdd-beto:init` again in each project: it enters update mode, proposes only what changed and, if you use local permissions, points them at the new version.

**Coming from 0.1.0:** the default changes from a gate at every stage to `flow` as soon as you update, even before running `init`. To keep the old behavior, add `"gate_mode": "strict"` to `.sdd/config.json`. Running `init` regenerates the "Aprobación humana" (human approval) section of `CLAUDE.md` for your mode and offers the commit permissions. Versions before 0.2.0 reject a config that contains `gate_mode` or `paths.backlog`.

## Documentation
All in Spanish:
- [Usage guide](docs/guia.md): adoption, one feature from start to finish, gates, fixes and troubleshooting.
- [Design decisions (ADRs)](docs/decisions/README.md).
- [Dry-run report](docs/06-prueba-en-seco.md): the full flow run with a real model.
- [Ideas and pending improvements](docs/ideas.md).
- [Changelog](CHANGELOG.md).

## Developing the plugin
- Structure: the root is the marketplace and the plugin lives in `plugins/sdd-beto/` (ADR-0014).
- Script tests: `node --test plugins/sdd-beto/scripts/test/`
- Validation: `claude plugin validate ./plugins/sdd-beto` and `claude plugin validate .`
- Trying it without installing: `claude --plugin-dir ./plugins/sdd-beto` in a test project.
- Reproducible dry run: `node tests/fixtures/dryrun/make-dryrun.mjs <destination>` (see the report).

## License
[MIT](LICENSE) (ADR-0028).

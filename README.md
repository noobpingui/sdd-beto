# sdd-beto

**English** · [Español](README.es.md)

A Claude Code plugin that installs a **Spec-Driven Development (SDD)** production line in any repository:

```
spec → plan → tasks → tests (red) → implement → verify → review → docs → close
```

Each stage is run by a specialized subagent with its own permissions. The main session orchestrates, and **you approve every stage, every commit and every push**. Hooks stop an agent from writing outside its role and stop production code from being touched without an approved spec and plan.

> **Language:** the agent and skill prompts, and the documentation under `docs/`, are in Spanish. The artifacts each project generates (`spec.md`, `plan.md`, reports) and the orchestrator's messages follow the `language` set in that project's `.sdd/config.json`, so an English project gets English artifacts.

## What you get
- **Traceable specs:** user story, requirements in EARS format and Given/When/Then acceptance criteria. Every criterion ends up in a test carrying the `SDD:` marker.
- **Real TDD:** tests are written before the code, and a `verifier` checks that they fail for the right reason (red check) before implementation starts.
- **Independent review:** a `reviewer` that uses the project's constitution as its checklist, with a fix loop capped by an iteration limit.
- **Up-to-date documentation:** a `doc-keeper` updates the affected documentation and the Project section of `CLAUDE.md`.
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

1. **`/sdd-beto:init`**: analyzes the repo and proposes, step by step and with your approval, the config, the project constitution and the `CLAUDE.md` sections. It ends with a commit on a `chore/sdd-init` branch.
2. **`/sdd-beto:new <slug> <idea>`**: creates the feature (number, branch and folder). For example: `/sdd-beto:new export-csv Export the monthly report to CSV`.
3. **`/sdd-beto:run`**: walks through the flow stage by stage. At the end of each one you'll see what was done, what you should review and the proposed commit; answer "approved" to continue.

The [usage guide](docs/guia.md) (in Spanish) explains each step in detail.

## Commands
| Command | What it does |
|---|---|
| `/sdd-beto:init [notes]` | Adopts the flow in the repo or updates it (idempotent) |
| `/sdd-beto:new <slug> <idea>` | Creates a feature: branch `feat/NNN-slug` and folder `<specs>/NNN-slug/` |
| `/sdd-beto:run [NNN-slug]` | Runs the next stage and chains the rest, with a gate at each one |
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

- **Artifacts:** each feature lives in `<specs>/NNN-slug/` (`idea.md`, `spec.md`, `plan.md`, `tasks.md`, `verify-report.md`, `review.md`, `docs-report.md` and `state.json`). `state.json` is the single source of truth for the state and only the plugin's `sdd-state` CLI changes it.
- **Constitution:** a base part, the same for every project, and a Part II specific to each project (`.sdd/constitution.md`), which can only tighten the base.
- **Hooks:** `role-guard` (each agent writes only to its own paths and in its own stage), `stage-guard` (production code isn't edited without an approved spec and plan) and `git-guard` (subagents only use read-only git).
- **Models:** they can be changed per project with `models` in `.sdd/config.json`.

## Updating and uninstalling
```
claude plugin marketplace update sdd-beto
claude plugin update sdd-beto@sdd-beto
claude plugin uninstall sdd-beto@sdd-beto
```
After updating, run `/sdd-beto:init` again in each project: it enters update mode, proposes only what changed and, if you use local permissions, points them at the new version.

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

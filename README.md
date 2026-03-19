# DataAnnotation

Annotation workbench for the `manual_check_data` review tasks used in the Q1/Q2 human-alignment workflow.

The current app supports:

- Folder upload for `manual_check_data`
- Manifest discovery and lazy loading of session `item.json`
- Q1 and Q2 task switching
- Left-side sample display with optional translation
- Right-side annotation forms with local draft persistence
- Annotation export
- GitHub Pages deployment through GitHub Actions

## Project structure

- [`src/q1-q2/app`](./src/q1-q2/app): top-level Q1/Q2 workbench shell
- [`src/q1-q2/components`](./src/q1-q2/components): display blocks, requirement panel, annotation pane, task forms
- [`src/q1-q2/data`](./src/q1-q2/data): uploaded folder indexing and manifest loading
- [`src/q1-q2/config`](./src/q1-q2/config): task requirement copy and static config
- [`src/guidelines/Q1-Q2-Annotation-Architecture.md`](./src/guidelines/Q1-Q2-Annotation-Architecture.md): architecture record for the current implementation
- [`manual_check_basic_logic`](./manual_check_basic_logic): task design docs
- [`manual_check_data`](./manual_check_data): extracted annotation source data used for local testing

## Requirements

- Node.js 20 or later
- npm

## Local development

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Build a production bundle locally:

```bash
npm run build
```

The local dev server uses the `/DataAnnotation/` base path by default.

## How to use the app

### 1. Upload data

The recommended input is the full `manual_check_data` folder.

The app also supports uploading a subtree such as:

- `benchmark_construction_check_data/`
- `LLM_as_judge_Human_Alignment_data/`
- a task-level or ability-level folder

Behavior:

- The app indexes uploaded files in the browser
- It reads `run_summary.json`, `config.snapshot.json`, and available `manifest.json` files
- It lazy-loads the currently selected `sessions/.../item.json`
- It does not rewrite the original uploaded files

### 2. Review a sample

For each sample:

- The left column shows the task-specific source data
- `Translate` only affects the left-side display
- The right column shows the task requirement and annotation form
- Q2 tasks support both `judge_visible` and `blind_human_scoring` modes

### 3. Save annotations

- Form edits are stored as annotation drafts in browser `localStorage`
- Original uploaded JSON files are not modified
- Saving is keyed by a stable draft key derived from the selected item

### 4. Download results

The app currently supports exporting annotation data from the browser.

Use:

- `Download annotations` to export saved annotation records
- `Download current item` to inspect the currently loaded sample payload

## Deployment

This project is configured for GitHub Pages deployment through GitHub Actions.

### What is configured

- Workflow file: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)
- Build command: `npm run build`
- Publish directory: `build/`
- Deployment branches:
  - `main`
  - `master`
  - `human_alignment_Q1_Q2`

### One-time GitHub setup

1. Open the GitHub repository.
2. Go to `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.

### How deployment works

- Each push to one of the deployment branches triggers the Pages workflow
- The workflow installs dependencies with `npm ci`
- Vite builds the app into `build/`
- GitHub Pages publishes the artifact automatically

### Base path behavior

The Vite `base` path is resolved automatically:

- In GitHub Actions, it uses the repository name from `GITHUB_REPOSITORY`
- Locally, it falls back to `/DataAnnotation/`

If you need to deploy under a different subpath, set `VITE_BASE_PATH` in the build environment.

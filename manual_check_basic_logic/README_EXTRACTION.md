# Extraction Script Usage

## Files

- Python script: `manual_check_data/scripts/extract_manual_check_data.py`
- Legacy JS script: `manual_check_data/scripts/extract_manual_check_data.js`
- Default config: `manual_check_data/configs/extraction.default.json`
- Analysis note: `manual_check_data/DATA_ANALYSIS.md`

## Run

```powershell
& "D:\Applications\Anaconda\envs\Alpsbench\python.exe" manual_check_data/scripts/extract_manual_check_data.py --config manual_check_data/configs/extraction.default.json
```

Optional output override:

```powershell
& "D:\Applications\Anaconda\envs\Alpsbench\python.exe" manual_check_data/scripts/extract_manual_check_data.py --config manual_check_data/configs/extraction.default.json --out manual_check_data/exports/manual_check_stratified_seed_20260319_v2_python
```

## What changed in this version

- sampling is now stratified instead of pure random
- benchmark sampling happens first
- judge/model assignment happens after benchmark sessions are chosen
- task4 ability5 is now supported from `task4_general_model_results/result`
- task4 ability5 uses two strata by default:
  - `en`
  - `ch`
- the Python version keeps the same JSON config shape as the JS version
- the Python version is structured into reusable helpers:
  - generic file I/O
  - deterministic RNG and stratified sampling
  - per-task loaders
  - a shared export pipeline

## Current sampling logic

- Task1: stratified by `probe.ground_truth_memories[0].label`
- Task2: stratified by selected memory label from `metadata.selected_memory_id`
- Task3: stratified by `selected_memory.label`
- Task4 ability1-4: stratified by selected memory label from `memory_key`
- Task4 ability5: stratified by dataset group (`en` / `ch`)

## Current default counts

- Task1 benchmark: `140`, judge: `140`
- Task2 benchmark: `140`, judge: `140`
- Task3 benchmark: `140`, judge: `140`
- Task4 ability1-4 benchmark: `28`, judge: `28`
- Task4 ability5 benchmark: `28`, judge: `24`

Note:

- task4 ability5 currently has 6 model result folders in `result`, so judge data defaults to `4 x 6 = 24`
- benchmark session sampling for ability5 is still `28`, which lets Q1 and Q2 stay decoupled when needed

## Outputs

The script writes:

- `benchmark_construction_check_data`
- `LLM_as_judge_Human_Alignment_data`
- per-task and per-ability `manifest.json`
- per-session `item.json`
- `cleaning_log.json`
- `run_summary.json`
- `config.snapshot.json`

## Change parameters later

Edit only the JSON config.

You can change:

- `benchmarkSampleCount`
- per-model `quota`
- Task3 `datasetVariant`
- Task4 ability5 dataset groups or model folders
- output directory and seed

## Reuse Notes

- the Python script is the recommended entry point for future maintenance
- if you add a new task or ability later, the intended place is a new loader function, not a rewrite of the main flow
- the RNG is intentionally JS-compatible, so the same seed can keep the same sampling behavior across the old and new implementations
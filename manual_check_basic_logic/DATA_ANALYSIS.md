# Update Notes (2026-03-19)

This section corrects several earlier assumptions after new files were added.

## Updated Findings

### Task 1 gpt-4.1-mini evaluation was refreshed

Earlier analysis treated `task1_eval_human_annotation_gpt-4.1-mini_again` as a partial subset.
That is no longer true.

Current observed line / unique `record_id` counts:

- claude-sonnet-4-5-20250929: `2628 / 2389`
- deepseek-reasoner: `2631 / 2392`
- gemini-3-flash-preview: `2629 / 2390`
- gpt-4.1-mini_again: `2627 / 2389`
- gpt-5.2: `2597 / 2361`
- llama-4-maverick: `2630 / 2391`
- qwen3-max: `2601 / 2365`

Current common `record_id` intersection across the 7 task1 model result files is:

- `2330`

So the earlier `241` overlap conclusion is obsolete.
It came from an older partial version of `gpt-4.1-mini_again`.

### Task 4 ability5 result files are now located

A new result directory exists:

- `D:\USTC\My_research\Alps_data\task4_general_model_results\result`

Observed model folders inside:

- `claude-sonnet-4.5`
- `gemini-3-flash`
- `gpt-4.1-mini`
- `gpt-5.2`
- `llama-4-maverick`
- `qwen3-max`

I did not see a `deepseek` ability5 result folder in this directory.

### Task 4 ability5 structure

Ability5 is currently split into two dataset groups that can be used directly for stratified sampling:

- English dataset: `huggingface/Alpsbench/dataset/task4/ability5_ei/final_data_English.json`
- Chinese dataset: `huggingface/Alpsbench/dataset/task4/ability5_ei/final_data_Chinese.json`

Corresponding result files are stored per model as:

- `en.json`
- `en_res.json`
- `ch.json`
- `ch_res.json`

Observed counts per model:

- `en.json`: `200` sessions
- `ch.json`: `60` sessions
- `en_res.json`: `1000` rows
- `ch_res.json`: `300` rows

Interpretation:

- `en.json` and `ch.json` store one item per session
- each session contains `5` responses
- `en_res.json` and `ch_res.json` repeat each session `5` times
- so ability5 extraction must first group by `session_id` before sampling or exporting

### Recommended task4 sampling interpretation now

- ability1-4: treat each ability as an independent session pool
- ability5: treat `en` and `ch` as two explicit strata
- benchmark construction sessions can be sampled first at the session level
- judge-alignment data can then be constructed from those sampled session IDs

This is now reflected in the extraction script and default config.

---
# Alps Data Analysis for Manual Check

## Scope

This document only analyzes the current data layout and the fields needed for the two manual-check tracks:

1. `benchmark_construction_check_data`
2. `LLM_as_judge_Human_Alignment_data`

No sampling code is run yet.

Relevant TODO files:

- `D:\USTC\My_research\Alps_data\TODO\Q1 Benchmark construction 是否合理.md`
- `D:\USTC\My_research\Alps_data\TODO\Q2 LLM-as-a-Judge 是否与真人对齐.md`

## Directories Created

Created:

- `D:\USTC\My_research\Alps_data\manual_check_data\benchmark_construction_check_data`
- `D:\USTC\My_research\Alps_data\manual_check_data\LLM_as_judge_Human_Alignment_data`

Assumption:

- I used `manual_check_data` as the parent directory for this phase.
- If you want a different parent name later, it is easy to rename without changing the data logic.

## High-Level Mapping

### Q1: Benchmark construction check

Need to verify whether the benchmark item itself is well-constructed.

By task:

- Task 1: original dialogue -> golden extracted memory
- Task 2: old memory + new dialogue -> golden updated memory
- Task 3: query -> target memory relation, optionally distractors
- Task 4: query -> memory -> ability relation

### Q2: LLM-as-a-Judge human alignment

Need to verify whether the stored judge output matches human judgment.

By task:

- Task 1: `pair_reviews / missing_reviews / extra_reviews`
- Task 2: `pair_reviews / missing_reviews / extra_reviews`
- Task 3: `used_memory / score / reason`
- Task 4: current exported result files mostly keep final score only; richer schema depends on eval code, not on current result dump

## Task 1

### Dataset location

Root:

- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task1`

Structure:

- many category files under nested folders
- each leaf is a `.jsonl`
- total files: `54`
- total records across all dataset files: `2631`

Example source file:

- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task1\ability1\Personal_Background\Education\direct.jsonl`

### Dataset format

Important note:

- each line starts with a prefix like `"direct"` or `"indirect"` immediately followed by JSON
- so raw lines are not plain JSON from the first character

Useful top-level fields from dataset line:

- `sessions`
- `memory_items`
- `memory_stage1_candidates`
- `selected_memory_id`
- `match`
- `intents_ranked`

Useful subfields:

- `sessions[].session_id`
- `sessions[].turns[].role`
- `sessions[].turns[].text`
- `memory_items[].memory_id`
- `memory_items[].label`
- `memory_items[].value`
- `memory_items[].reasoning`
- `memory_items[].evidence`
- `selected_memory_id`

### For Q1

Recommended fields to keep:

- `session_id`
- source file path
- direct/indirect tag
- original dialogue: `sessions[].turns`
- golden answer candidates: `memory_items`
- selected golden target if needed: `selected_memory_id`
- matched session provenance: `match`

### Model output + judge result location

Root:

- `D:\USTC\My_research\Alps_data\task1_general_model_results\task1_results`

Models found: `7`

- claude-sonnet-4-5-20250929
- deepseek-reasoner
- gemini-3-flash-preview
- gpt-4.1-mini_again
- gpt-5.2
- llama-4-maverick
- qwen3-max

Example result file:

- `D:\USTC\My_research\Alps_data\task1_general_model_results\task1_results\task1_eval_human_annotation_gpt-5.2\evaluation_reports.jsonl`

Example line count:

- gpt-5.2 result lines: `2597`

This does not exactly match Task 1 dataset total `2631`, so downstream sampling must intersect by available IDs instead of assuming full coverage.

### Result format

Top-level fields:

- `record_id`
- `probe`
- `report`
- `score`

Useful `probe` fields:

- `dialogue`
- `ground_truth_memories`
- `query`
- `metadata`

Useful `report.runs[0]` fields:

- `model`
- `raw_output`
- `memory_items`

Useful `score.runs[0].score` fields:

- `matching.accepted_pairs`
- `matching.missing_in_pred`
- `matching.extra_in_pred`
- `metrics`
- `algo_score`
- `llm_score`
- `final_score`

Most important judge fields for Q2:

- `score.runs[0].score.llm_score.raw.pair_reviews`
- `score.runs[0].score.llm_score.raw.missing_reviews`
- `score.runs[0].score.llm_score.raw.extra_reviews`

Within reviews, the TODO doc indicates the key fields are:

- pair: `ok`, `error_type`, `severity`, `rationale`
- missing: `should_have_extracted`, `severity`, `rationale`
- extra: `hallucinated`, `severity`, `rationale`

## Task 2

### Dataset location

- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task2\task2_dataset.jsonl`

Line count:

- `2615`

### Dataset format

Top-level fields:

- `record_id`
- `record`
- `memory`
- `query`
- `answer`
- `metadata`

Useful `record` fields:

- `old_dialogue`
- `new_dialogue`

Useful `memory[]` fields:

- `memory_id`
- `type`
- `label`
- `label_suggestion`
- `value`
- `reasoning`
- `evidence`
- `confidence`
- `time_scope`
- `emotion`
- `preference_attitude`
- `updated_at`

Useful `answer[]` fields:

- same schema as memory item, representing golden updated memory output

Useful `metadata` fields:

- `dialog_id`
- `session_id`
- `selected_memory_id`
- `controls`

### For Q1

Recommended fields to keep:

- `session_id`
- old memory: `memory`
- new dialogue: `record.new_dialogue`
- old dialogue if needed: `record.old_dialogue`
- golden updated memory: `answer`
- controls: `metadata.controls`

### Model output + judge result location

Root:

- `D:\USTC\My_research\Alps_data\task2_general_model_results\task2_results`

Models found: `7`

- claude-sonnet-4-5-20250929
- deepseek-reasoner
- gemini-3-flash-preview
- gpt-4.1-mini
- gpt-5.2
- meta-llama
- qwen3_max_ali

Example result file:

- `D:\USTC\My_research\Alps_data\task2_general_model_results\task2_results\task2_results_gpt-5.2\gpt-5.2_scored.jsonl`

Example line count:

- gpt-5.2 result lines: `2614`

Again, this is not a perfect one-to-one match with dataset `2615`.

### Result format

Top-level fields:

- `entry`
- `report`
- `score`

Useful `entry` fields:

- `record_id`
- `record`
- `memory`
- `query`
- `answer`
- `metadata`

Useful `report.runs[0]` fields:

- `model`
- `raw_output`
- `memory_items`

Useful `score.runs[0].score` fields:

- `matching`
- `metrics`
- `algo_score`
- `llm_score`
- `final_score`
- `explain`

Most important judge fields for Q2:

- `score.runs[0].score.llm_score.raw.pair_reviews`
- `score.runs[0].score.llm_score.raw.missing_reviews`
- `score.runs[0].score.llm_score.raw.extra_reviews`

This matches the Q2 TODO description very well.

## Task 3

### Dataset location

Files:

- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task3\generated_probes.jsonl`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task3\task3_dataset_d100.jsonl`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task3\task3_dataset_d300.jsonl`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task3\task3_dataset_d500.jsonl`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task3\task3_dataset_d700.jsonl`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task3\task3_dataset_d1000.jsonl`

For your current plan, Task 3 should use:

- `task3_dataset_d100.jsonl`

Line count:

- `2620`

### Dataset format

Top-level fields:

- `seed_id`
- `record`

Useful `record` fields:

- `dialogue`
- `selected_memory_id`
- `selected_memory`
- `candidate_memories`
- `query`
- `metadata`

Useful nested fields:

- `record.selected_memory.memory_id`
- `record.selected_memory.value`
- `record.selected_memory.label`
- `record.candidate_memories[]`
- `record.metadata.session_id`
- `record.metadata.dialog_id`

### For Q1

Recommended fields to keep:

- `session_id`
- query: `record.query`
- target memory: `record.selected_memory`
- distractor pool: `record.candidate_memories`
- distractor setting source file, here fixed to `d100`

### Model output + judge result location

Current planned result root:

- `D:\USTC\My_research\Alps_data\task3_general_model_results\task3_results\d100`

Models found at `d100`:

- claude-sonnet-4-5-20250929
- deepseek-reasoner
- gemini-3-flash-preview
- gpt-4.1-mini
- gpt-5.2
- llama-4-maverick
- qwen3-max

Also present but not part of the 7 LLMs:

- bm25 baseline
- vector baseline

Example result file:

- `D:\USTC\My_research\Alps_data\task3_general_model_results\task3_results\d100\task3_d100_results_gpt-5.2\gpt-5.2_scored.jsonl`

Line count:

- `2620`

### Result format

Top-level fields:

- `entry`
- `report`
- `score`

Useful `entry.record` fields:

- `dialogue`
- `selected_memory_id`
- `selected_memory`
- `candidate_memories`
- `query`
- `metadata`

Useful `report.runs[0]` fields:

- `model`
- `raw_output`
- `parsed_response`
- `judge`
- `used_memory`

Useful judge fields for Q2:

- `report.runs[0].judge.used_memory`
- `report.runs[0].judge.score`
- `report.runs[0].judge.reason`

Duplicate compact copy also exists at:

- `score.runs[0].judge`

This exactly matches the Task 3 Q2 TODO description.

## Task 4

## Dataset location

Files:

- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task4\ability1.json`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task4\ability2.json`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task4\ability3.json`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task4\ability4.json`
- `D:\USTC\My_research\Alps_data\huggingface\Alpsbench\dataset\task4\ability5_ei\*.json`

Observed counts:

- ability1: `570`
- ability2: `1232`
- ability3: `500`
- ability4: `329`
- ability5_ei is split by language file, for example:
  - English: `200`
  - Chinese: `60`
  - Arabic: `24`
  - French: `16`

### Dataset format

For ability1-4, each item has:

- `session_id`
- `queries`
- `conversation`
- `extracted_memory`
- `memory_key`

Useful fields:

- `queries[].query_id`
- `queries[].query`
- `conversation[].role`
- `conversation[].text`
- `extracted_memory[]`
- `memory_key`

For ability5_ei, items are similar but I did not see `memory_key` in the sampled files:

- `session_id`
- `queries`
- `conversation`
- `extracted_memory`

### For Q1

Recommended fields to keep:

- `session_id`
- query: `queries[].query`
- dialogue history: `conversation`
- memory: `extracted_memory`
- for ability1-4, selected target indicator: `memory_key`

Important caveat:

- I did not find an explicit field in sampled task4 data that directly labels the subcategory split you mentioned for ability2.
- I also did not find an explicit field in sampled ability5 files that directly marks a second category split.
- So if we must do `14 + 14` within ability2 and ability5, we likely need either:
  - a manual rule from your benchmark design knowledge, or
  - an additional derivation rule based on file/source semantics

## Task 4 model outputs and scores

### Result location

Root:

- `D:\USTC\My_research\Alps_data\task4_general_model_results`

Models found: `7`

- vanilla_claude4.5
- vanilla_deepseekr1
- vanilla_gemini3.5
- vanilla_gpt4.1-mini
- vanilla_gpt5.2
- vanilla_llama4
- vanilla_qwen3

Each model folder currently contains:

- `ability1.json`
- `ability1_res.json`
- `ability2.json`
- `ability2_res.json`
- `ability3.json`
- `ability3_res.json`
- `ability4.json`
- `ability4_res.json`

Important current gap:

- I did **not** find `ability5` result files under `task4_general_model_results`

### Model output file format

Example:

- `D:\USTC\My_research\Alps_data\task4_general_model_results\vanilla_gpt5.2\ability2.json`

Each item has:

- `session_id`
- `responses`

Useful nested fields:

- `responses[].query_id`
- `responses[].response`

This is the model output text you need for manual checking.

### Score file format

Example:

- `D:\USTC\My_research\Alps_data\task4_general_model_results\vanilla_gpt5.2\ability2_res.json`

Each item has:

- `session_id`
- `response`
- `score`

Observed counts for gpt-5.2:

- ability1_res: `570`
- ability2_res: `1231`
- ability3_res: `500`
- ability4_res: `327`

These do not perfectly match the dataset counts:

- ability2 dataset `1232` vs result `1231`
- ability4 dataset `329` vs result `327`

So Task 4 also needs ID intersection during sampling.

### Judge schema caveat for Task 4

Current exported result files only preserve:

- model response text
- final numeric score

They do **not** preserve rich structured judge reasoning per item in the same way as Task 1-3.

However, the evaluation code shows why:

- `D:\USTC\My_research\Alps_data\task4_eval\task4_eval\eval.py`
- `D:\USTC\My_research\Alps_data\task4_eval\task4_eval\utils.py`
- `D:\USTC\My_research\Alps_data\task4_eval\task4_eval\prompts.py`
- `D:\USTC\My_research\Alps_data\task4_eval\task4_eval\ei\eval.py`
- `D:\USTC\My_research\Alps_data\task4_eval\task4_eval\ei\utils.py`

What the code reveals:

- ability1-4 use binary judge prompts and finally save only integer `score`
- ability5 EI uses 1-5 dimension scores such as `resonation`, `expression`, `reception`
- the helper `extract_score` functions only extract numeric score from judge output before saving

So for Task 4, current stored results are **compressed evaluation outputs**, not full raw judge JSON.

This matters for Q2:

- Task 4 Q2 can currently align humans against stored numeric scores
- but cannot directly align humans against a richer per-field judge JSON unless there is another hidden raw-output dump elsewhere

## Minimal field set recommendation

If the goal is to build reproducible manual-check datasets later, I recommend the exported row schema include these common fields:

- `task`
- `check_track` (`benchmark_construction` or `llm_as_judge_alignment`)
- `session_id`
- `source_dataset_file`
- `source_result_file`
- `model_name`
- `query_id`
- `query`
- `dialogue_or_conversation`
- `target_memory`
- `candidate_or_full_memory_pool`
- `gold_answer_or_gold_memory`
- `model_response`
- `judge_output_raw`
- `judge_score`
- `sampling_bucket`
- `sampling_rule`
- `sampling_seed`
- `cleaning_log`

## Sampling constraints from your instruction

Planned target counts:

- Task 1: 140 items total, then each of 7 models contributes 20 model outputs for the selected 140 sessions
- Task 2: 140 items total, same 20 x 7 logic
- Task 3: use `d100`, total 140 items
- Task 4: 28 items per ability

Task 4 clarification based on current files:

- ability1, ability3, ability4 clearly exist in both dataset and model-result form
- ability2 exists, but I did not find an explicit subtype field for the two-category split
- ability5 dataset exists, but I did not find corresponding model result files in `task4_general_model_results`

So before execution, Task 4 needs one confirmation:

- whether ability5 model outputs live elsewhere, or
- whether current execution should only cover ability1-4

## Proposed next execution order

If this analysis is approved, the next step should be:

1. define a stable parent export directory schema under `manual_check_data`
2. write a read-only sampler that intersects available dataset IDs and result IDs
3. log every dropped/missing ID into a cleaning log
4. export one manifest CSV/JSON per task before exporting full per-session folders
5. only after the manifest looks right, materialize per-session directories

## Key blockers / mismatches already identified

- Task 1 dataset count and model result count do not exactly match
- Task 2 dataset count and model result count do not exactly match
- Task 4 ability2 and ability4 counts do not exactly match between dataset and result
- Task 4 ability5 result files are not currently found in `task4_general_model_results`
- Task 4 current stored judge output is compressed to scores, unlike Task 1-3
- Task 4 ability2 / ability5 subtype split is not obviously explicit in sampled raw data


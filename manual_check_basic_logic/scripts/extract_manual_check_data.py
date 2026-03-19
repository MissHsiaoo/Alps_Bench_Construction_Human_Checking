#!/usr/bin/env python
"""Reusable manual-check data extractor.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class PoolItem:
    """A sampled benchmark candidate before a model is assigned."""

    canonical_id: str
    session_id: str
    stratum: str
    stratum_source: str
    source_dataset_file: str | None
    original: Any


@dataclass(frozen=True)
class JudgeItem:
    """Model output and judge result aligned to one canonical record."""

    canonical_id: str
    session_id: str
    stratum: str
    stratum_source: str
    source_dataset_file: str | None
    source_result_file: str | None
    original: Any
    model_output: Any
    judge_output_raw: Any
    judge_score: Any
    final_score: Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract reproducible manual-check datasets.")
    parser.add_argument("--config", default="manual_check_data/configs/extraction.default.json")
    parser.add_argument("--out", default=None)
    return parser.parse_args()


def ensure_dir(dir_path: Path) -> None:
    dir_path.mkdir(parents=True, exist_ok=True)


def read_json(file_path: Path) -> Any:
    with file_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_jsonl(file_path: Path, line_parser: Callable[[str], Any] | None = None) -> list[Any]:
    parser = line_parser or json.loads
    rows: list[Any] = []
    with file_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if stripped:
                rows.append(parser(stripped))
    return rows


def write_json(file_path: Path, value: Any) -> None:
    ensure_dir(file_path.parent)
    with file_path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False)


def safe_name(value: Any) -> str:
    return re.sub(r'[\\/:*?"<>|\s]+', "_", str(value))


def xmur3(seed_text: str) -> Callable[[], int]:
    """Match the JavaScript seed hashing so old and new scripts stay aligned."""

    h = 1779033703 ^ len(seed_text)
    for char in seed_text:
        h = ((h ^ ord(char)) * 3432918353) & 0xFFFFFFFF
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF

    def next_value() -> int:
        nonlocal h
        h = ((h ^ (h >> 16)) * 2246822507) & 0xFFFFFFFF
        h = ((h ^ (h >> 13)) * 3266489909) & 0xFFFFFFFF
        h = (h ^ (h >> 16)) & 0xFFFFFFFF
        return h

    return next_value


class JsCompatibleRng:
    """A deterministic RNG that mirrors the previous JS implementation."""

    def __init__(self, seed_value: Any):
        seed_fn = xmur3(str(seed_value))
        self._state = seed_fn() & 0xFFFFFFFF

    def random(self) -> float:
        self._state = (self._state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self._state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def shuffle(items: Iterable[Any], rng: JsCompatibleRng) -> list[Any]:
    values = list(items)
    for index in range(len(values) - 1, 0, -1):
        swap_index = int(rng.random() * (index + 1))
        values[index], values[swap_index] = values[swap_index], values[index]
    return values


def mean(values: Iterable[float]) -> float | None:
    numbers = list(values)
    if not numbers:
        return None
    return sum(numbers) / len(numbers)


def total(values: Iterable[int]) -> int:
    return sum(values)


def intersect_arrays(arrays: list[list[str]]) -> list[str]:
    if not arrays:
        return []
    first, *rest = arrays
    rest_sets = [set(items) for items in rest]
    return [item for item in first if all(item in current for current in rest_sets)]


def pick_first_defined(values: Iterable[Any]) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def locate_single_file(dir_path: Path, matcher: Callable[[str], bool]) -> Path | None:
    candidates = [entry.name for entry in dir_path.iterdir() if entry.is_file() and matcher(entry.name)]
    if not candidates:
        return None
    if len(candidates) == 1:
        return dir_path / candidates[0]
    preferred = next((name for name in candidates if re.search(r"_scored\.jsonl$", name, re.IGNORECASE)), candidates[0])
    return dir_path / preferred


def session_folder_name(item: PoolItem | JudgeItem | dict[str, Any]) -> str:
    if isinstance(item, dict):
        session_id = item.get("session_id") or "missing_session"
        canonical_id = item.get("canonical_id")
    else:
        session_id = item.session_id or "missing_session"
        canonical_id = item.canonical_id
    return f"{safe_name(session_id)}__{safe_name(canonical_id)}"


def count_by(items: Iterable[Any], key_fn: Callable[[Any], Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        key = str(key_fn(item))
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda pair: pair[0]))


def balanced_stratified_sample(items: list[PoolItem], target_count: int, rng: JsCompatibleRng) -> list[PoolItem]:
    """Distribute picks across strata as evenly as possible, then randomize order."""

    if target_count > len(items):
        raise ValueError(f"Requested {target_count} items but only {len(items)} are available.")

    groups: dict[str, list[PoolItem]] = {}
    for item in items:
        groups.setdefault(item.stratum or "UNSPECIFIED", []).append(item)
    groups = {stratum: shuffle(values, rng) for stratum, values in groups.items()}

    quotas = {stratum: 0 for stratum in groups}
    remaining = target_count
    while remaining > 0:
        eligible = [stratum for stratum, values in groups.items() if quotas[stratum] < len(values)]
        if not eligible:
            break
        progressed = False
        for stratum in shuffle(eligible, rng):
            if remaining == 0:
                break
            if quotas[stratum] < len(groups[stratum]):
                quotas[stratum] += 1
                remaining -= 1
                progressed = True
        if not progressed:
            break

    selected: list[PoolItem] = []
    for stratum, quota in quotas.items():
        selected.extend(groups[stratum][:quota])
    return shuffle(selected, rng)


def assign_judge_models(sampled_items: list[PoolItem], judge_model_quotas: dict[str, int], rng: JsCompatibleRng) -> dict[str, str]:
    """Randomly map the judge quota onto the already selected benchmark sessions."""

    total_judge_count = total(judge_model_quotas.values())
    if total_judge_count > len(sampled_items):
        raise ValueError(
            f"Judge quota total {total_judge_count} exceeds sampled benchmark size {len(sampled_items)}."
        )

    judge_candidates = shuffle(sampled_items, rng)[:total_judge_count]
    candidate_ids = shuffle([item.canonical_id for item in judge_candidates], rng)
    assignments: dict[str, str] = {}
    cursor = 0
    for model_name, quota in judge_model_quotas.items():
        for _ in range(quota):
            assignments[candidate_ids[cursor]] = model_name
            cursor += 1
    return assignments


def make_pool_item(
    canonical_id: Any,
    session_id: Any,
    stratum: Any,
    stratum_source: str,
    source_dataset_file: Path | None,
    original: Any,
) -> PoolItem:
    return PoolItem(
        canonical_id=str(canonical_id),
        session_id=str(session_id),
        stratum=str(stratum or "UNKNOWN"),
        stratum_source=stratum_source,
        source_dataset_file=str(source_dataset_file) if source_dataset_file else None,
        original=original,
    )


def make_judge_item(
    canonical_id: Any,
    session_id: Any,
    stratum: Any,
    stratum_source: str,
    source_dataset_file: Path | None,
    source_result_file: Path | None,
    original: Any,
    model_output: Any,
    judge_output_raw: Any,
    judge_score: Any,
    final_score: Any,
) -> JudgeItem:
    return JudgeItem(
        canonical_id=str(canonical_id),
        session_id=str(session_id),
        stratum=str(stratum or "UNKNOWN"),
        stratum_source=stratum_source,
        source_dataset_file=str(source_dataset_file) if source_dataset_file else None,
        source_result_file=str(source_result_file) if source_result_file else None,
        original=original,
        model_output=model_output,
        judge_output_raw=judge_output_raw,
        judge_score=judge_score,
        final_score=final_score,
    )


def load_task1_models(root_dir: Path, requested_models: list[str]) -> dict[str, dict[str, JudgeItem]]:
    result_root = root_dir / "task1_general_model_results" / "task1_results"
    found: dict[str, dict[str, JudgeItem]] = {}
    for model_name in requested_models:
        file_path = result_root / f"task1_eval_human_annotation_{model_name}" / "evaluation_reports.jsonl"
        if not file_path.exists():
            raise FileNotFoundError(f"Task1 result file not found: {file_path}")

        model_map: dict[str, JudgeItem] = {}
        for record in read_jsonl(file_path):
            canonical_id = str(record["record_id"])
            run = ((record.get("report") or {}).get("runs") or [{}])[0]
            score_obj = ((((record.get("score") or {}).get("runs") or [{}])[0]).get("score") or {})
            session_id = pick_first_defined(
                [
                    ((record.get("probe") or {}).get("metadata") or {}).get("session_id"),
                    next(
                        (
                            (item.get("evidence") or {}).get("session_id")
                            for item in ((record.get("probe") or {}).get("ground_truth_memories") or [])
                            if (item.get("evidence") or {}).get("session_id")
                        ),
                        None,
                    ),
                    f"task1_record_{canonical_id}",
                ]
            )
            model_map[canonical_id] = make_judge_item(
                canonical_id=canonical_id,
                session_id=session_id,
                stratum=(((record.get("probe") or {}).get("ground_truth_memories") or [{}])[0]).get("label"),
                stratum_source="probe.ground_truth_memories[0].label",
                source_dataset_file=None,
                source_result_file=file_path,
                original={"record_id": record.get("record_id"), "probe": record.get("probe") or {}},
                model_output={"raw_output": run.get("raw_output"), "memory_items": run.get("memory_items") or []},
                judge_output_raw=((score_obj.get("llm_score") or {}).get("raw")),
                judge_score=((score_obj.get("llm_score") or {}).get("score_100")),
                final_score=((score_obj.get("final_score") or {}).get("score_100")),
            )
        found[model_name] = model_map
    return found


def task2_selected_label(entry: dict[str, Any]) -> str:
    selected_id = ((entry.get("metadata") or {}).get("selected_memory_id"))
    memory_item = next((item for item in (entry.get("memory") or []) if item.get("memory_id") == selected_id), None)
    return (memory_item or {}).get("label") or "UNKNOWN"


def load_task2_models(root_dir: Path, requested_models: list[str]) -> dict[str, dict[str, JudgeItem]]:
    result_root = root_dir / "task2_general_model_results" / "task2_results"
    dataset_file = root_dir / "huggingface" / "Alpsbench" / "dataset" / "task2" / "task2_dataset.jsonl"
    found: dict[str, dict[str, JudgeItem]] = {}
    for model_name in requested_models:
        model_dir = result_root / f"task2_results_{model_name}"
        if not model_dir.exists():
            raise FileNotFoundError(f"Task2 model dir not found: {model_dir}")
        file_path = locate_single_file(model_dir, lambda name: bool(re.search(r"scored\.jsonl$", name, re.IGNORECASE)))
        if file_path is None:
            raise FileNotFoundError(f"Task2 scored file not found in {model_dir}")

        model_map: dict[str, JudgeItem] = {}
        for record in read_jsonl(file_path):
            entry = record.get("entry") or {}
            canonical_id = str(pick_first_defined([((entry.get("metadata") or {}).get("session_id")), entry.get("record_id")]))
            run = ((record.get("report") or {}).get("runs") or [{}])[0]
            score_obj = ((((record.get("score") or {}).get("runs") or [{}])[0]).get("score") or {})
            model_map[canonical_id] = make_judge_item(
                canonical_id=canonical_id,
                session_id=((entry.get("metadata") or {}).get("session_id")) or f"task2_record_{entry.get('record_id')}",
                stratum=task2_selected_label(entry),
                stratum_source="entry.memory[label by metadata.selected_memory_id]",
                source_dataset_file=dataset_file,
                source_result_file=file_path,
                original=entry,
                model_output={"raw_output": run.get("raw_output"), "memory_items": run.get("memory_items") or []},
                judge_output_raw=((score_obj.get("llm_score") or {}).get("raw")),
                judge_score=((score_obj.get("llm_score") or {}).get("score_100")),
                final_score=((score_obj.get("final_score") or {}).get("score_100")),
            )
        found[model_name] = model_map
    return found
def load_task3_models(root_dir: Path, requested_models: list[str], dataset_variant: str) -> dict[str, dict[str, JudgeItem]]:
    result_root = root_dir / "task3_general_model_results" / "task3_results" / dataset_variant
    dataset_file = root_dir / "huggingface" / "Alpsbench" / "dataset" / "task3" / f"task3_dataset_{dataset_variant}.jsonl"
    found: dict[str, dict[str, JudgeItem]] = {}
    for model_name in requested_models:
        model_dir = result_root / f"task3_{dataset_variant}_results_{model_name}"
        if not model_dir.exists():
            raise FileNotFoundError(f"Task3 model dir not found: {model_dir}")
        file_path = locate_single_file(model_dir, lambda name: bool(re.search(r"scored\.jsonl$", name, re.IGNORECASE)))
        if file_path is None:
            raise FileNotFoundError(f"Task3 scored file not found in {model_dir}")

        model_map: dict[str, JudgeItem] = {}
        for record in read_jsonl(file_path):
            entry = record.get("entry") or {}
            entry_record = entry.get("record") or {}
            canonical_id = str(pick_first_defined([((entry_record.get("metadata") or {}).get("session_id")), entry.get("seed_id")]))
            run = ((record.get("report") or {}).get("runs") or [{}])[0]
            judge = run.get("judge") or (((record.get("score") or {}).get("runs") or [{}])[0]).get("judge")
            model_map[canonical_id] = make_judge_item(
                canonical_id=canonical_id,
                session_id=((entry_record.get("metadata") or {}).get("session_id")) or f"task3_seed_{entry.get('seed_id')}",
                stratum=((entry_record.get("selected_memory") or {}).get("label")) or "UNKNOWN",
                stratum_source="entry.record.selected_memory.label",
                source_dataset_file=dataset_file,
                source_result_file=file_path,
                original=entry_record,
                model_output={
                    "raw_output": run.get("raw_output"),
                    "parsed_response": run.get("parsed_response"),
                    "used_memory": run.get("used_memory"),
                },
                judge_output_raw=judge,
                judge_score=(judge or {}).get("score") if judge else None,
                final_score=(judge or {}).get("score") if judge else None,
            )
        found[model_name] = model_map
    return found


def load_task4_dataset_map(
    root_dir: Path,
    dataset_file: str,
    stratum_resolver: Callable[[dict[str, Any]], str],
    stratum_source: str,
) -> dict[str, PoolItem]:
    file_path = root_dir / dataset_file
    items = read_json(file_path)
    pool_map: dict[str, PoolItem] = {}
    for item in items:
        canonical_id = str(item["session_id"])
        pool_map[canonical_id] = make_pool_item(
            canonical_id=canonical_id,
            session_id=canonical_id,
            stratum=stratum_resolver(item),
            stratum_source=stratum_source,
            source_dataset_file=file_path,
            original=item,
        )
    return pool_map


def task4_memory_key_label(item: dict[str, Any]) -> str:
    selected = next((memory for memory in (item.get("extracted_memory") or []) if memory.get("memory_id") == item.get("memory_key")), None)
    return (selected or {}).get("label") or "UNKNOWN"


def load_task4_ability14_model_maps(
    root_dir: Path, ability_name: str, requested_models: list[str]
) -> dict[str, dict[str, dict[str, Any]]]:
    result_root = root_dir / "task4_general_model_results"
    found: dict[str, dict[str, dict[str, Any]]] = {}
    for model_name in requested_models:
        model_dir = result_root / model_name
        response_file = model_dir / f"{ability_name}.json"
        score_file = model_dir / f"{ability_name}_res.json"
        if not response_file.exists() or not score_file.exists():
            raise FileNotFoundError(f"Task4 {ability_name} files not found for {model_name}")

        responses = read_json(response_file)
        scores = read_json(score_file)
        response_map = {str(item["session_id"]): item for item in responses}
        score_map = {str(item["session_id"]): item for item in scores}
        common_ids = intersect_arrays([list(response_map.keys()), list(score_map.keys())])

        model_map: dict[str, dict[str, Any]] = {}
        for canonical_id in common_ids:
            response_item = response_map[canonical_id]
            score_item = score_map[canonical_id]
            model_map[canonical_id] = {
                "source_result_file": str(response_file),
                "model_output": {
                    "responses": response_item.get("responses") or [],
                    "response_text": score_item.get("response"),
                },
                "judge_output_raw": score_item,
                "judge_score": score_item.get("score"),
                "final_score": score_item.get("score"),
            }
        found[model_name] = model_map
    return found


def aggregate_ability5_score_rows(score_rows: list[dict[str, Any]]) -> dict[str, float | int | None]:
    return {
        "response_count": len(score_rows),
        "avg_resonation": mean(float(row["resonation"]) for row in score_rows if row.get("resonation") is not None),
        "avg_expression": mean(float(row["expression"]) for row in score_rows if row.get("expression") is not None),
        "avg_reception": mean(float(row["reception"]) for row in score_rows if row.get("reception") is not None),
    }


def load_task4_ability5_model_maps(root_dir: Path, ability_config: dict[str, Any]) -> dict[str, dict[str, dict[str, Any]]]:
    result_root = root_dir / ability_config["resultDir"]
    found: dict[str, dict[str, dict[str, Any]]] = {}
    for model_alias, model_spec in ability_config["judgeModels"].items():
        model_dir = result_root / model_spec["resultFolder"]
        if not model_dir.exists():
            raise FileNotFoundError(f"Task4 ability5 model dir not found: {model_dir}")

        model_map: dict[str, dict[str, Any]] = {}
        for group_name, group_spec in ability_config["datasetGroups"].items():
            response_file = model_dir / group_spec["resultResponseFile"]
            score_file = model_dir / group_spec["resultScoreFile"]
            if not response_file.exists() or not score_file.exists():
                raise FileNotFoundError(f"Task4 ability5 files not found for {model_alias} {group_name}")

            responses = read_json(response_file)
            score_rows = read_json(score_file)
            response_map = {str(item["session_id"]): item for item in responses}
            score_map: dict[str, list[dict[str, Any]]] = {}
            for row in score_rows:
                session_id = str(row["session_id"])
                score_map.setdefault(session_id, []).append(row)

            common_ids = intersect_arrays([list(response_map.keys()), list(score_map.keys())])
            for canonical_id in common_ids:
                response_item = response_map[canonical_id]
                grouped_scores = score_map[canonical_id]
                if len(response_item.get("responses") or []) != len(grouped_scores):
                    raise ValueError(
                        f"Task4 ability5 mismatch for {model_alias} {canonical_id}: "
                        f"responses {len(response_item.get('responses') or [])}, scores {len(grouped_scores)}"
                    )
                aggregated_score = aggregate_ability5_score_rows(grouped_scores)
                model_map[canonical_id] = {
                    "source_result_file": str(response_file),
                    "model_output": {
                        "responses": response_item.get("responses") or [],
                        "score_rows": grouped_scores,
                    },
                    "judge_output_raw": grouped_scores,
                    "judge_score": aggregated_score,
                    "final_score": aggregated_score,
                }
        found[model_alias] = model_map
    return found
def build_task_pool(root_dir: Path, task_name: str, task_config: dict[str, Any]) -> tuple[dict[str, PoolItem], dict[str, dict[str, JudgeItem]]]:
    if task_name == "task1":
        judge_models = load_task1_models(root_dir, list(task_config["judgeModels"].keys()))
    elif task_name == "task2":
        judge_models = load_task2_models(root_dir, list(task_config["judgeModels"].keys()))
    elif task_name == "task3":
        judge_models = load_task3_models(root_dir, list(task_config["judgeModels"].keys()), task_config["datasetVariant"])
    else:
        raise ValueError(f"Unknown task pool builder: {task_name}")

    common_ids = intersect_arrays([list(model_map.keys()) for model_map in judge_models.values()])
    first_model = next(iter(judge_models.values()))
    pool = {
        canonical_id: make_pool_item(
            canonical_id=judge_item.canonical_id,
            session_id=judge_item.session_id,
            stratum=judge_item.stratum,
            stratum_source=judge_item.stratum_source,
            source_dataset_file=Path(judge_item.source_dataset_file) if judge_item.source_dataset_file else None,
            original=judge_item.original,
        )
        for canonical_id, judge_item in ((canonical_id, first_model[canonical_id]) for canonical_id in common_ids)
    }
    return pool, judge_models


def build_task4_ability_pool(
    root_dir: Path, ability_name: str, ability_config: dict[str, Any]
) -> tuple[dict[str, PoolItem], dict[str, dict[str, JudgeItem]]]:
    if ability_name == "ability5":
        pool: dict[str, PoolItem] = {}
        for group_name, group_spec in ability_config["datasetGroups"].items():
            dataset_map = load_task4_dataset_map(
                root_dir=root_dir,
                dataset_file=group_spec["datasetFile"],
                stratum_resolver=lambda _item, value=group_name: value,
                stratum_source="dataset group",
            )
            pool.update(dataset_map)

        raw_judge_models = load_task4_ability5_model_maps(root_dir, ability_config)
        common_ids = intersect_arrays([list(pool.keys()), *[list(model_map.keys()) for model_map in raw_judge_models.values()]])
        filtered_pool = {canonical_id: pool[canonical_id] for canonical_id in common_ids}
        judge_models = {
            model_alias: {
                canonical_id: make_judge_item(
                    canonical_id=canonical_id,
                    session_id=canonical_id,
                    stratum=filtered_pool[canonical_id].stratum,
                    stratum_source=filtered_pool[canonical_id].stratum_source,
                    source_dataset_file=Path(filtered_pool[canonical_id].source_dataset_file)
                    if filtered_pool[canonical_id].source_dataset_file
                    else None,
                    source_result_file=Path(payload["source_result_file"]) if payload["source_result_file"] else None,
                    original=filtered_pool[canonical_id].original,
                    model_output=payload["model_output"],
                    judge_output_raw=payload["judge_output_raw"],
                    judge_score=payload["judge_score"],
                    final_score=payload["final_score"],
                )
                for canonical_id, payload in model_map.items()
                if canonical_id in filtered_pool
            }
            for model_alias, model_map in raw_judge_models.items()
        }
        return filtered_pool, judge_models

    pool = load_task4_dataset_map(
        root_dir=root_dir,
        dataset_file=ability_config["datasetFile"],
        stratum_resolver=task4_memory_key_label,
        stratum_source="dataset extracted_memory[label by memory_key]",
    )
    raw_judge_models = load_task4_ability14_model_maps(
        root_dir,
        ability_name,
        [spec["resultFolder"] for spec in ability_config["judgeModels"].values()],
    )

    alias_to_payload_map = {
        alias: raw_judge_models[spec["resultFolder"]]
        for alias, spec in ability_config["judgeModels"].items()
    }
    common_ids = intersect_arrays([list(pool.keys()), *[list(model_map.keys()) for model_map in alias_to_payload_map.values()]])
    filtered_pool = {canonical_id: pool[canonical_id] for canonical_id in common_ids}
    judge_models = {
        alias: {
            canonical_id: make_judge_item(
                canonical_id=canonical_id,
                session_id=canonical_id,
                stratum=filtered_pool[canonical_id].stratum,
                stratum_source=filtered_pool[canonical_id].stratum_source,
                source_dataset_file=Path(filtered_pool[canonical_id].source_dataset_file)
                if filtered_pool[canonical_id].source_dataset_file
                else None,
                source_result_file=Path(payload["source_result_file"]) if payload["source_result_file"] else None,
                original=filtered_pool[canonical_id].original,
                model_output=payload["model_output"],
                judge_output_raw=payload["judge_output_raw"],
                judge_score=payload["judge_score"],
                final_score=payload["final_score"],
            )
            for canonical_id, payload in model_map.items()
            if canonical_id in filtered_pool
        }
        for alias, model_map in alias_to_payload_map.items()
    }
    return filtered_pool, judge_models


def write_payloads(
    task_label: str,
    benchmark_root: Path,
    judge_root: Path,
    selected_benchmark_items: list[PoolItem],
    judge_assignments: dict[str, str],
    judge_models: dict[str, dict[str, JudgeItem]],
    run_seed: str,
) -> None:
    benchmark_manifest: list[dict[str, Any]] = []
    judge_manifest: list[dict[str, Any]] = []

    for pool_item in selected_benchmark_items:
        assigned_model = judge_assignments.get(pool_item.canonical_id)
        benchmark_payload = {
            "task": task_label,
            "canonical_id": pool_item.canonical_id,
            "session_id": pool_item.session_id,
            "stratum": pool_item.stratum,
            "stratum_source": pool_item.stratum_source,
            "assigned_model_for_judge_track": assigned_model,
            "source_dataset_file": pool_item.source_dataset_file,
            "original": pool_item.original,
            "sampling": {
                "seed": run_seed,
                "selected_for_benchmark_track": True,
                "selected_for_judge_track": bool(assigned_model),
            },
        }
        benchmark_manifest.append(
            {
                "canonical_id": pool_item.canonical_id,
                "session_id": pool_item.session_id,
                "stratum": pool_item.stratum,
                "assigned_model_for_judge_track": assigned_model,
            }
        )
        write_json(benchmark_root / "sessions" / session_folder_name(benchmark_payload) / "item.json", benchmark_payload)

        if assigned_model:
            judge_item = judge_models[assigned_model][pool_item.canonical_id]
            judge_payload = {
                "task": task_label,
                "canonical_id": pool_item.canonical_id,
                "session_id": pool_item.session_id,
                "stratum": pool_item.stratum,
                "stratum_source": pool_item.stratum_source,
                "assigned_model": assigned_model,
                "source_dataset_file": pool_item.source_dataset_file,
                "source_result_file": judge_item.source_result_file,
                "original": pool_item.original,
                "model_output": judge_item.model_output,
                "judge_output_raw": judge_item.judge_output_raw,
                "judge_score": judge_item.judge_score,
                "final_score": judge_item.final_score,
                "sampling": {
                    "seed": run_seed,
                    "selected_for_judge_track": True,
                },
            }
            judge_manifest.append(
                {
                    "canonical_id": pool_item.canonical_id,
                    "session_id": pool_item.session_id,
                    "stratum": pool_item.stratum,
                    "assigned_model": assigned_model,
                }
            )
            write_json(judge_root / "sessions" / session_folder_name(judge_payload) / "item.json", judge_payload)

    write_json(benchmark_root / "manifest.json", benchmark_manifest)
    write_json(judge_root / "manifest.json", judge_manifest)


def run_one_task(
    task_label: str,
    pool: dict[str, PoolItem],
    judge_models: dict[str, dict[str, JudgeItem]],
    benchmark_sample_count: int,
    judge_model_quotas: dict[str, int],
    rng: JsCompatibleRng,
    output_root: Path,
    run_seed: str,
    summary: dict[str, Any],
) -> None:
    pool_items = list(pool.values())
    sampled_benchmark_items = balanced_stratified_sample(pool_items, benchmark_sample_count, rng)
    judge_assignments = assign_judge_models(sampled_benchmark_items, judge_model_quotas, rng)

    task_parts = task_label.split("/")
    benchmark_root = output_root / "benchmark_construction_check_data" / Path(*task_parts)
    judge_root = output_root / "LLM_as_judge_Human_Alignment_data" / Path(*task_parts)
    write_payloads(task_label, benchmark_root, judge_root, sampled_benchmark_items, judge_assignments, judge_models, run_seed)

    cleaning_log = {
        "task": task_label,
        "seed": run_seed,
        "pool_size": len(pool_items),
        "benchmark_sample_count": len(sampled_benchmark_items),
        "judge_sample_count": len(judge_assignments),
        "pool_stratum_distribution": count_by(pool_items, lambda item: item.stratum),
        "benchmark_stratum_distribution": count_by(sampled_benchmark_items, lambda item: item.stratum),
        "judge_model_quotas": judge_model_quotas,
        "judge_model_distribution": count_by(judge_assignments.items(), lambda pair: pair[1]),
        "judge_sampled_ids": list(judge_assignments.keys()),
    }
    write_json(output_root / Path(*task_parts) / f"{safe_name(task_label)}_cleaning_log.json", cleaning_log)

    summary["tasks"].append(
        {
            "task": task_label,
            "pool_size": len(pool_items),
            "benchmark_sample_count": len(sampled_benchmark_items),
            "judge_sample_count": len(judge_assignments),
        }
    )


def main() -> None:
    args = parse_args()
    config_path = (WORKSPACE_ROOT / args.config).resolve() if not Path(args.config).is_absolute() else Path(args.config)
    config = read_json(config_path)
    output_root = (
        (WORKSPACE_ROOT / args.out).resolve()
        if args.out and not Path(args.out).is_absolute()
        else Path(args.out).resolve()
        if args.out
        else (WORKSPACE_ROOT / config["outputDir"]).resolve()
    )
    ensure_dir(output_root)

    rng = JsCompatibleRng(config["seed"])
    summary: dict[str, Any] = {
        "seed": config["seed"],
        "config_path": str(config_path),
        "output_root": str(output_root),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tasks": [],
    }

    write_json(output_root / "config.snapshot.json", config)

    for task_name in ["task1", "task2", "task3"]:
        task_config = ((config.get("tasks") or {}).get(task_name) or {})
        if not task_config.get("enabled"):
            continue
        pool, judge_models = build_task_pool(WORKSPACE_ROOT, task_name, task_config)
        judge_model_quotas = {alias: spec["quota"] for alias, spec in task_config["judgeModels"].items()}
        run_one_task(
            task_label=task_name,
            pool=pool,
            judge_models=judge_models,
            benchmark_sample_count=task_config["benchmarkSampleCount"],
            judge_model_quotas=judge_model_quotas,
            rng=rng,
            output_root=output_root,
            run_seed=config["seed"],
            summary=summary,
        )

    task4_config = ((config.get("tasks") or {}).get("task4") or {})
    if task4_config.get("enabled"):
        for ability_name, ability_config in (task4_config.get("abilities") or {}).items():
            if not ability_config.get("enabled"):
                continue
            pool, judge_models = build_task4_ability_pool(WORKSPACE_ROOT, ability_name, ability_config)
            judge_model_quotas = {alias: spec["quota"] for alias, spec in ability_config["judgeModels"].items()}
            run_one_task(
                task_label=f"task4/{ability_name}",
                pool=pool,
                judge_models=judge_models,
                benchmark_sample_count=ability_config["benchmarkSampleCount"],
                judge_model_quotas=judge_model_quotas,
                rng=rng,
                output_root=output_root,
                run_seed=config["seed"],
                summary=summary,
            )

    write_json(output_root / "run_summary.json", summary)
    print(f"Extraction complete. Output root: {output_root}")
    for item in summary["tasks"]:
        print(
            f"- {item['task']}: pool {item['pool_size']}, "
            f"benchmark {item['benchmark_sample_count']}, judge {item['judge_sample_count']}"
        )


if __name__ == "__main__":
    main()
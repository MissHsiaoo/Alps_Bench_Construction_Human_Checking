#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath, lineParser = JSON.parse) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(lineParser);
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function safeName(value) {
  return String(value).replace(/[\\/:*?"<>|\s]+/g, '_');
}

function xmur3(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i += 1) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seedInt) {
  return function rand() {
    let t = (seedInt += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seedValue) {
  const seedFn = xmur3(String(seedValue));
  return mulberry32(seedFn());
}

function shuffle(array, rand) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function intersectArrays(arrays) {
  if (!arrays.length) return [];
  const [first, ...rest] = arrays;
  const restSets = rest.map((items) => new Set(items));
  return first.filter((item) => restSets.every((set) => set.has(item)));
}

function pickFirstDefined(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function locateSingleFile(dirPath, matcher) {
  const candidates = fs.readdirSync(dirPath).filter((name) => matcher(name));
  if (!candidates.length) return null;
  if (candidates.length === 1) return path.join(dirPath, candidates[0]);
  const preferred = candidates.find((name) => /_scored\.jsonl$/i.test(name)) || candidates[0];
  return path.join(dirPath, preferred);
}

function sessionFolderName(item) {
  return `${safeName(item.session_id || 'missing_session')}__${safeName(item.canonical_id)}`;
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function balancedStratifiedSample(items, targetCount, rand) {
  if (targetCount > items.length) {
    throw new Error(`Requested ${targetCount} items but only ${items.length} are available.`);
  }
  const groups = new Map();
  for (const item of items) {
    const stratum = item.stratum || 'UNSPECIFIED';
    if (!groups.has(stratum)) groups.set(stratum, []);
    groups.get(stratum).push(item);
  }
  for (const [stratum, values] of groups.entries()) {
    groups.set(stratum, shuffle(values, rand));
  }

  const quotas = new Map([...groups.keys()].map((key) => [key, 0]));
  let remaining = targetCount;
  while (remaining > 0) {
    const eligible = [...groups.keys()].filter((stratum) => quotas.get(stratum) < groups.get(stratum).length);
    if (!eligible.length) break;
    const round = shuffle(eligible, rand);
    let progressed = false;
    for (const stratum of round) {
      if (remaining === 0) break;
      if (quotas.get(stratum) < groups.get(stratum).length) {
        quotas.set(stratum, quotas.get(stratum) + 1);
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  const selected = [];
  for (const [stratum, quota] of quotas.entries()) {
    selected.push(...groups.get(stratum).slice(0, quota));
  }
  return shuffle(selected, rand);
}

function assignJudgeModels(sampledItems, judgeModelQuotas, rand) {
  const totalJudgeCount = sum(Object.values(judgeModelQuotas));
  if (totalJudgeCount > sampledItems.length) {
    throw new Error(`Judge quota total ${totalJudgeCount} exceeds sampled benchmark size ${sampledItems.length}.`);
  }
  const judgeCandidates = shuffle(sampledItems, rand).slice(0, totalJudgeCount);
  const assignments = new Map();
  const ids = shuffle(judgeCandidates.map((item) => item.canonical_id), rand);
  let cursor = 0;
  for (const [modelName, quota] of Object.entries(judgeModelQuotas)) {
    for (let i = 0; i < quota; i += 1) {
      assignments.set(ids[cursor], modelName);
      cursor += 1;
    }
  }
  return assignments;
}

function normalizeTask1DatasetLine(rawLine) {
  return JSON.parse(rawLine.replace(/^"(direct|indirect)"/, ''));
}

function loadTask1Models(rootDir, requestedModels) {
  const resultRoot = path.join(rootDir, 'task1_general_model_results', 'task1_results');
  const found = {};
  for (const modelName of requestedModels) {
    const dir = path.join(resultRoot, `task1_eval_human_annotation_${modelName}`);
    const filePath = path.join(dir, 'evaluation_reports.jsonl');
    if (!fs.existsSync(filePath)) throw new Error(`Task1 result file not found: ${filePath}`);
    const records = readJsonl(filePath);
    const map = new Map();
    for (const record of records) {
      const canonicalId = String(record.record_id);
      const run = record.report?.runs?.[0] || {};
      const scoreObj = record.score?.runs?.[0]?.score || {};
      const sessionId = pickFirstDefined([
        record.probe?.metadata?.session_id,
        (record.probe?.ground_truth_memories || []).map((item) => item?.evidence?.session_id).find(Boolean),
        `task1_record_${canonicalId}`,
      ]);
      map.set(canonicalId, {
        canonical_id: canonicalId,
        session_id: sessionId,
        stratum: (record.probe?.ground_truth_memories || [])[0]?.label || 'UNKNOWN',
        stratum_source: 'probe.ground_truth_memories[0].label',
        source_dataset_file: null,
        source_result_file: filePath,
        original: {
          record_id: record.record_id,
          probe: record.probe || {},
        },
        model_output: {
          raw_output: run.raw_output ?? null,
          memory_items: run.memory_items ?? [],
        },
        judge_output_raw: scoreObj.llm_score?.raw ?? null,
        judge_score: scoreObj.llm_score?.score_100 ?? null,
        final_score: scoreObj.final_score?.score_100 ?? null,
      });
    }
    found[modelName] = map;
  }
  return found;
}

function task2SelectedLabel(entry) {
  const selectedId = entry.metadata?.selected_memory_id;
  const memoryItem = (entry.memory || []).find((item) => item.memory_id === selectedId);
  return memoryItem?.label || 'UNKNOWN';
}

function loadTask2Models(rootDir, requestedModels) {
  const resultRoot = path.join(rootDir, 'task2_general_model_results', 'task2_results');
  const found = {};
  for (const modelName of requestedModels) {
    const dir = path.join(resultRoot, `task2_results_${modelName}`);
    if (!fs.existsSync(dir)) throw new Error(`Task2 model dir not found: ${dir}`);
    const filePath = locateSingleFile(dir, (name) => /scored\.jsonl$/i.test(name));
    if (!filePath) throw new Error(`Task2 scored file not found in ${dir}`);
    const records = readJsonl(filePath);
    const map = new Map();
    for (const record of records) {
      const entry = record.entry || {};
      const canonicalId = String(pickFirstDefined([entry.metadata?.session_id, entry.record_id]));
      const run = record.report?.runs?.[0] || {};
      const scoreObj = record.score?.runs?.[0]?.score || {};
      map.set(canonicalId, {
        canonical_id: canonicalId,
        session_id: entry.metadata?.session_id || `task2_record_${entry.record_id}`,
        stratum: task2SelectedLabel(entry),
        stratum_source: 'entry.memory[label by metadata.selected_memory_id]',
        source_dataset_file: path.join(rootDir, 'huggingface', 'Alpsbench', 'dataset', 'task2', 'task2_dataset.jsonl'),
        source_result_file: filePath,
        original: entry,
        model_output: {
          raw_output: run.raw_output ?? null,
          memory_items: run.memory_items ?? [],
        },
        judge_output_raw: scoreObj.llm_score?.raw ?? null,
        judge_score: scoreObj.llm_score?.score_100 ?? null,
        final_score: scoreObj.final_score?.score_100 ?? null,
      });
    }
    found[modelName] = map;
  }
  return found;
}

function loadTask3Models(rootDir, requestedModels, datasetVariant) {
  const resultRoot = path.join(rootDir, 'task3_general_model_results', 'task3_results', datasetVariant);
  const found = {};
  for (const modelName of requestedModels) {
    const dir = path.join(resultRoot, `task3_${datasetVariant}_results_${modelName}`);
    if (!fs.existsSync(dir)) throw new Error(`Task3 model dir not found: ${dir}`);
    const filePath = locateSingleFile(dir, (name) => /scored\.jsonl$/i.test(name));
    if (!filePath) throw new Error(`Task3 scored file not found in ${dir}`);
    const records = readJsonl(filePath);
    const map = new Map();
    for (const record of records) {
      const entry = record.entry || {};
      const entryRecord = entry.record || {};
      const canonicalId = String(pickFirstDefined([entryRecord.metadata?.session_id, entry.seed_id]));
      const run = record.report?.runs?.[0] || {};
      const judge = run.judge || record.score?.runs?.[0]?.judge || null;
      map.set(canonicalId, {
        canonical_id: canonicalId,
        session_id: entryRecord.metadata?.session_id || `task3_seed_${entry.seed_id}`,
        stratum: entryRecord.selected_memory?.label || 'UNKNOWN',
        stratum_source: 'entry.record.selected_memory.label',
        source_dataset_file: path.join(rootDir, 'huggingface', 'Alpsbench', 'dataset', 'task3', `task3_dataset_${datasetVariant}.jsonl`),
        source_result_file: filePath,
        original: entryRecord,
        model_output: {
          raw_output: run.raw_output ?? null,
          parsed_response: run.parsed_response ?? null,
          used_memory: run.used_memory ?? null,
        },
        judge_output_raw: judge,
        judge_score: judge?.score ?? null,
        final_score: judge?.score ?? null,
      });
    }
    found[modelName] = map;
  }
  return found;
}

function loadTask4DatasetMap(rootDir, datasetFile, stratumResolver) {
  const filePath = path.join(rootDir, datasetFile);
  const items = readJson(filePath);
  const map = new Map();
  for (const item of items) {
    const canonicalId = String(item.session_id);
    map.set(canonicalId, {
      canonical_id: canonicalId,
      session_id: canonicalId,
      stratum: stratumResolver(item),
      source_dataset_file: filePath,
      original: item,
    });
  }
  return map;
}

function task4MemoryKeyLabel(item) {
  const selected = (item.extracted_memory || []).find((memory) => memory.memory_id === item.memory_key);
  return selected?.label || 'UNKNOWN';
}

function loadTask4Ability14ModelMaps(rootDir, abilityName, requestedModels) {
  const resultRoot = path.join(rootDir, 'task4_general_model_results');
  const found = {};
  for (const modelName of requestedModels) {
    const modelDir = path.join(resultRoot, modelName);
    const responseFile = path.join(modelDir, `${abilityName}.json`);
    const scoreFile = path.join(modelDir, `${abilityName}_res.json`);
    if (!fs.existsSync(responseFile) || !fs.existsSync(scoreFile)) {
      throw new Error(`Task4 ${abilityName} files not found for ${modelName}`);
    }
    const responses = readJson(responseFile);
    const scores = readJson(scoreFile);
    const responseMap = new Map(responses.map((item) => [String(item.session_id), item]));
    const scoreMap = new Map(scores.map((item) => [String(item.session_id), item]));
    const commonIds = intersectArrays([Array.from(responseMap.keys()), Array.from(scoreMap.keys())]);
    const map = new Map();
    for (const canonicalId of commonIds) {
      const responseItem = responseMap.get(canonicalId);
      const scoreItem = scoreMap.get(canonicalId);
      map.set(canonicalId, {
        canonical_id: canonicalId,
        session_id: canonicalId,
        source_result_file: responseFile,
        model_output: {
          responses: responseItem.responses || [],
          response_text: scoreItem.response ?? null,
        },
        judge_output_raw: scoreItem,
        judge_score: scoreItem.score ?? null,
        final_score: scoreItem.score ?? null,
      });
    }
    found[modelName] = map;
  }
  return found;
}

function aggregateAbility5ScoreRows(scoreRows) {
  return {
    response_count: scoreRows.length,
    avg_resonation: mean(scoreRows.map((row) => Number(row.resonation)).filter((value) => Number.isFinite(value))),
    avg_expression: mean(scoreRows.map((row) => Number(row.expression)).filter((value) => Number.isFinite(value))),
    avg_reception: mean(scoreRows.map((row) => Number(row.reception)).filter((value) => Number.isFinite(value))),
  };
}

function loadTask4Ability5ModelMaps(rootDir, abilityConfig) {
  const resultRoot = path.join(rootDir, abilityConfig.resultDir);
  const found = {};
  for (const [modelAlias, modelSpec] of Object.entries(abilityConfig.judgeModels)) {
    const modelDir = path.join(resultRoot, modelSpec.resultFolder);
    if (!fs.existsSync(modelDir)) {
      throw new Error(`Task4 ability5 model dir not found: ${modelDir}`);
    }
    const map = new Map();
    for (const [groupName, groupSpec] of Object.entries(abilityConfig.datasetGroups)) {
      const responseFile = path.join(modelDir, groupSpec.resultResponseFile);
      const scoreFile = path.join(modelDir, groupSpec.resultScoreFile);
      if (!fs.existsSync(responseFile) || !fs.existsSync(scoreFile)) {
        throw new Error(`Task4 ability5 files not found for ${modelAlias} ${groupName}`);
      }
      const responses = readJson(responseFile);
      const responseMap = new Map(responses.map((item) => [String(item.session_id), item]));
      const scoreRows = readJson(scoreFile);
      const scoreMap = new Map();
      for (const row of scoreRows) {
        const sessionId = String(row.session_id);
        if (!scoreMap.has(sessionId)) scoreMap.set(sessionId, []);
        scoreMap.get(sessionId).push(row);
      }
      const commonIds = intersectArrays([Array.from(responseMap.keys()), Array.from(scoreMap.keys())]);
      for (const canonicalId of commonIds) {
        const responseItem = responseMap.get(canonicalId);
        const scoreItems = scoreMap.get(canonicalId);
        if ((responseItem.responses || []).length !== scoreItems.length) {
          throw new Error(`Task4 ability5 mismatch for ${modelAlias} ${canonicalId}: responses ${responseItem.responses.length}, scores ${scoreItems.length}`);
        }
        map.set(canonicalId, {
          canonical_id: canonicalId,
          session_id: canonicalId,
          source_result_file: responseFile,
          model_output: {
            responses: responseItem.responses,
            score_rows: scoreItems,
          },
          judge_output_raw: scoreItems,
          judge_score: aggregateAbility5ScoreRows(scoreItems),
          final_score: aggregateAbility5ScoreRows(scoreItems),
        });
      }
    }
    found[modelAlias] = map;
  }
  return found;
}

function buildTaskPool(rootDir, taskName, taskConfig) {
  if (taskName === 'task1') {
    const judgeModels = loadTask1Models(rootDir, Object.keys(taskConfig.judgeModels));
    const commonIds = intersectArrays(Object.values(judgeModels).map((map) => Array.from(map.keys())));
    const pool = new Map(commonIds.map((id) => [id, judgeModels[Object.keys(judgeModels)[0]].get(id)]));
    return { pool, judgeModels };
  }
  if (taskName === 'task2') {
    const judgeModels = loadTask2Models(rootDir, Object.keys(taskConfig.judgeModels));
    const commonIds = intersectArrays(Object.values(judgeModels).map((map) => Array.from(map.keys())));
    const pool = new Map(commonIds.map((id) => [id, judgeModels[Object.keys(judgeModels)[0]].get(id)]));
    return { pool, judgeModels };
  }
  if (taskName === 'task3') {
    const judgeModels = loadTask3Models(rootDir, Object.keys(taskConfig.judgeModels), taskConfig.datasetVariant);
    const commonIds = intersectArrays(Object.values(judgeModels).map((map) => Array.from(map.keys())));
    const pool = new Map(commonIds.map((id) => [id, judgeModels[Object.keys(judgeModels)[0]].get(id)]));
    return { pool, judgeModels };
  }
  throw new Error(`Unknown task pool builder: ${taskName}`);
}

function buildTask4AbilityPool(rootDir, abilityName, abilityConfig) {
  if (abilityName === 'ability5') {
    const pool = new Map();
    for (const [groupName, groupSpec] of Object.entries(abilityConfig.datasetGroups)) {
      const datasetMap = loadTask4DatasetMap(rootDir, groupSpec.datasetFile, () => groupName);
      for (const [id, item] of datasetMap.entries()) {
        item.stratum = groupName;
        item.stratum_source = 'dataset group';
        pool.set(id, item);
      }
    }
    const judgeModels = loadTask4Ability5ModelMaps(rootDir, abilityConfig);
    const commonIds = intersectArrays([Array.from(pool.keys()), ...Object.values(judgeModels).map((map) => Array.from(map.keys()))]);
    const filteredPool = new Map(commonIds.map((id) => [id, pool.get(id)]));
    return { pool: filteredPool, judgeModels };
  }

  const pool = loadTask4DatasetMap(rootDir, abilityConfig.datasetFile, task4MemoryKeyLabel);
  for (const item of pool.values()) {
    item.stratum_source = 'dataset extracted_memory[label by memory_key]';
  }
  const judgeModels = loadTask4Ability14ModelMaps(rootDir, abilityName, Object.values(abilityConfig.judgeModels).map((spec) => spec.resultFolder));
  const aliasToMap = {};
  const entries = Object.entries(abilityConfig.judgeModels);
  for (const [alias, spec] of entries) {
    aliasToMap[alias] = judgeModels[spec.resultFolder];
  }
  const commonIds = intersectArrays([Array.from(pool.keys()), ...Object.values(aliasToMap).map((map) => Array.from(map.keys()))]);
  const filteredPool = new Map(commonIds.map((id) => [id, pool.get(id)]));
  return { pool: filteredPool, judgeModels: aliasToMap };
}

function writePayloads({
  taskLabel,
  benchmarkRoot,
  judgeRoot,
  selectedBenchmarkItems,
  judgeAssignments,
  judgeModels,
  runSeed,
}) {
  const benchmarkManifest = [];
  const judgeManifest = [];
  for (const poolItem of selectedBenchmarkItems) {
    const assignedModel = judgeAssignments.get(poolItem.canonical_id) || null;
    const benchmarkPayload = {
      task: taskLabel,
      canonical_id: poolItem.canonical_id,
      session_id: poolItem.session_id,
      stratum: poolItem.stratum,
      stratum_source: poolItem.stratum_source,
      assigned_model_for_judge_track: assignedModel,
      source_dataset_file: poolItem.source_dataset_file || null,
      original: poolItem.original,
      sampling: {
        seed: runSeed,
        selected_for_benchmark_track: true,
        selected_for_judge_track: Boolean(assignedModel),
      },
    };
    benchmarkManifest.push({
      canonical_id: poolItem.canonical_id,
      session_id: poolItem.session_id,
      stratum: poolItem.stratum,
      assigned_model_for_judge_track: assignedModel,
    });
    writeJson(path.join(benchmarkRoot, 'sessions', sessionFolderName(benchmarkPayload), 'item.json'), benchmarkPayload);

    if (assignedModel) {
      const judgeItem = judgeModels[assignedModel].get(poolItem.canonical_id);
      const judgePayload = {
        task: taskLabel,
        canonical_id: poolItem.canonical_id,
        session_id: poolItem.session_id,
        stratum: poolItem.stratum,
        stratum_source: poolItem.stratum_source,
        assigned_model: assignedModel,
        source_dataset_file: poolItem.source_dataset_file || null,
        source_result_file: judgeItem.source_result_file || null,
        original: poolItem.original,
        model_output: judgeItem.model_output,
        judge_output_raw: judgeItem.judge_output_raw,
        judge_score: judgeItem.judge_score,
        final_score: judgeItem.final_score,
        sampling: {
          seed: runSeed,
          selected_for_judge_track: true,
        },
      };
      judgeManifest.push({
        canonical_id: poolItem.canonical_id,
        session_id: poolItem.session_id,
        stratum: poolItem.stratum,
        assigned_model: assignedModel,
      });
      writeJson(path.join(judgeRoot, 'sessions', sessionFolderName(judgePayload), 'item.json'), judgePayload);
    }
  }
  writeJson(path.join(benchmarkRoot, 'manifest.json'), benchmarkManifest);
  writeJson(path.join(judgeRoot, 'manifest.json'), judgeManifest);
}

function runOneTask({
  taskLabel,
  pool,
  judgeModels,
  benchmarkSampleCount,
  judgeModelQuotas,
  rng,
  outputRoot,
  runSeed,
  summary,
}) {
  const poolItems = [...pool.values()];
  const sampledBenchmarkItems = balancedStratifiedSample(poolItems, benchmarkSampleCount, rng);
  const judgeAssignments = assignJudgeModels(sampledBenchmarkItems, judgeModelQuotas, rng);
  const benchmarkRoot = path.join(outputRoot, 'benchmark_construction_check_data', ...taskLabel.split('/'));
  const judgeRoot = path.join(outputRoot, 'LLM_as_judge_Human_Alignment_data', ...taskLabel.split('/'));
  writePayloads({
    taskLabel,
    benchmarkRoot,
    judgeRoot,
    selectedBenchmarkItems: sampledBenchmarkItems,
    judgeAssignments,
    judgeModels,
    runSeed,
  });

  const cleaningLog = {
    task: taskLabel,
    seed: runSeed,
    pool_size: poolItems.length,
    benchmark_sample_count: sampledBenchmarkItems.length,
    judge_sample_count: judgeAssignments.size,
    pool_stratum_distribution: countBy(poolItems, (item) => item.stratum),
    benchmark_stratum_distribution: countBy(sampledBenchmarkItems, (item) => item.stratum),
    judge_model_quotas: judgeModelQuotas,
    judge_model_distribution: countBy([...judgeAssignments.entries()], ([, model]) => model),
    judge_sampled_ids: [...judgeAssignments.keys()],
  };
  writeJson(path.join(outputRoot, ...taskLabel.split('/'), `${safeName(taskLabel)}_cleaning_log.json`), cleaningLog);

  summary.tasks.push({
    task: taskLabel,
    pool_size: poolItems.length,
    benchmark_sample_count: sampledBenchmarkItems.length,
    judge_sample_count: judgeAssignments.size,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = path.resolve(WORKSPACE_ROOT, args.config || 'manual_check_data/configs/extraction.default.json');
  const config = readJson(configPath);
  const outputRoot = path.resolve(WORKSPACE_ROOT, args.out || config.outputDir);
  ensureDir(outputRoot);

  const rng = createRng(config.seed);
  const summary = {
    seed: config.seed,
    config_path: configPath,
    output_root: outputRoot,
    generated_at: new Date().toISOString(),
    tasks: [],
  };

  writeJson(path.join(outputRoot, 'config.snapshot.json'), config);

  for (const taskName of ['task1', 'task2', 'task3']) {
    const taskConfig = config.tasks?.[taskName];
    if (!taskConfig?.enabled) continue;
    const { pool, judgeModels } = buildTaskPool(WORKSPACE_ROOT, taskName, taskConfig);
    const judgeModelQuotas = Object.fromEntries(Object.entries(taskConfig.judgeModels).map(([alias, spec]) => [alias, spec.quota]));
    runOneTask({
      taskLabel: taskName,
      pool,
      judgeModels,
      benchmarkSampleCount: taskConfig.benchmarkSampleCount,
      judgeModelQuotas,
      rng,
      outputRoot,
      runSeed: config.seed,
      summary,
    });
  }

  const task4Config = config.tasks?.task4;
  if (task4Config?.enabled) {
    for (const [abilityName, abilityConfig] of Object.entries(task4Config.abilities || {})) {
      if (!abilityConfig?.enabled) continue;
      const { pool, judgeModels } = buildTask4AbilityPool(WORKSPACE_ROOT, abilityName, abilityConfig);
      const judgeModelQuotas = Object.fromEntries(Object.entries(abilityConfig.judgeModels).map(([alias, spec]) => [alias, spec.quota]));
      runOneTask({
        taskLabel: `task4/${abilityName}`,
        pool,
        judgeModels,
        benchmarkSampleCount: abilityConfig.benchmarkSampleCount,
        judgeModelQuotas,
        rng,
        outputRoot,
        runSeed: config.seed,
        summary,
      });
    }
  }

  writeJson(path.join(outputRoot, 'run_summary.json'), summary);
  console.log(`Extraction complete. Output root: ${outputRoot}`);
  for (const item of summary.tasks) {
    console.log(`- ${item.task}: pool ${item.pool_size}, benchmark ${item.benchmark_sample_count}, judge ${item.judge_sample_count}`);
  }
}

main();

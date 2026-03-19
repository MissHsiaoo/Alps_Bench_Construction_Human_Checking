# Q1/Q2 Annotation Web Architecture

## Status

Architecture record for the next-stage Q1/Q2 annotation web.

This document is intentionally implementation-oriented. It is designed to guide code changes with five constraints in mind:

1. Feasibility with the current React + Vite app
2. Strong decoupling between tasks
3. High maintainability and easy future edits
4. Clear and attractive UI structure
5. Safe upload, display, save, and download behavior

---

## 1. Scope and Product Goal

The current app is already an annotation workbench:

- upload a data file
- browse one sample at a time
- display the source content on the left
- annotate on the right
- save the current annotation into in-memory state
- auto-back up drafts to `localStorage`
- export all annotations by download

The new Q1/Q2 app should keep that workbench model and replace only the task-specific logic.

The target product supports:

- `Q1 Benchmark Construction`
- `Q2 LLM-as-a-Judge Alignment`
- task-level pages for `task1`, `task2`, `task3`, `task4`
- ability-level pages for `task4`
- English-only UI
- optional translation for displayed sample content
- explicit `Save` workflow
- robust draft recovery and download

This architecture does **not** assume direct file-system write-back from the browser.

---

## 2. Feasibility Decisions

### 2.1 Keep the existing workbench shell

The current [IntentApp.tsx](/D:/USTC/My_research/Alps_Human_Alignment_Annotation/DataAnnotation/src/IntentApp.tsx) already has the right high-level pattern:

- one current sample
- left-side display
- right-side form
- previous/next/jump
- save into `modifications`
- auto-save to `localStorage`
- download all

So the Q1/Q2 implementation should **replace the business layer, not the app shape**.

### 2.2 Do not use the current `MemoryApp` as the base

[MemoryApp.tsx](/D:/USTC/My_research/Alps_Human_Alignment_Annotation/DataAnnotation/src/MemoryApp.tsx) is optimized for free-form text selection inside JSON. Q1/Q2 are rubric-based evaluation tasks, not free-form extraction tasks.

The correct architectural base is the current `IntentApp` pattern, plus reusable left-side display modules.

### 2.3 Prefer normalized task bundles over raw folder traversal in the browser

The current `manual_check_data` layout is folder-based:

- `manifest.json`
- `sessions/<session-id>__<canonical-id>/item.json`

That is excellent for offline organization. It also means the app should treat `manual_check_data` as a structured dataset rather than a flat file.

For this project, the recommended runtime input is:

- the full `manual_check_data` root folder
- or a narrower subfolder such as one track folder or one task folder

Examples:

- `manual_check_data/`
- `manual_check_data/benchmark_construction_check_data/task1/`
- `manual_check_data/LLM_as_judge_Human_Alignment_data/task4/ability5/`

This requires directory upload support in the browser.

That is feasible in Chromium-based environments using `webkitdirectory`.

### 2.3.1 Recommended import priority

The app should support three input modes, in this order:

1. root folder import from `manual_check_data`
2. partial folder import from one track/task/ability subtree
3. bundle JSON import as a fallback for testing or sharing

### 2.3.2 Why root folder import is preferred here

- it matches the real project data already on disk
- it avoids requiring users to preprocess data before annotation
- it preserves the manifest-to-item lazy-loading model
- it reduces duplication of large sample payloads

### 2.3.3 What parts of `manual_check_data` are actually used

The app should use the folder as three layers:

- dataset metadata layer
  - `run_summary.json`
  - `config.snapshot.json`
- sample index layer
  - `benchmark_construction_check_data/**/manifest.json`
  - `LLM_as_judge_Human_Alignment_data/**/manifest.json`
- sample payload layer
  - `sessions/**/item.json`

The following files are optional and should be treated as debug/support data, not runtime-critical annotation input:

- `task1/task1_cleaning_log.json`
- `task2/task2_cleaning_log.json`
- `task3/task3_cleaning_log.json`
- `task4/**/task4_*_cleaning_log.json`

### 2.3.4 How the app should read `manual_check_data`

The browser should not eagerly parse every `item.json`.

Instead it should:

1. build a file index from uploaded folder contents using `webkitRelativePath`
2. detect available tracks/tasks/abilities from known manifest paths
3. read only the selected `manifest.json`
4. read one current `item.json` lazily on demand

This keeps memory use low and matches the current app's "one sample at a time" model.

### 2.4 Save annotations separately from raw sample content

The app should never overwrite:

- `original`
- `model_output`
- `judge_output_raw`
- `judge_score`
- `final_score`

All human work should be written to a separate `annotation` field.

This keeps the raw sample immutable and makes re-export, diffing, and schema evolution safer.

---

## 3. High-Level UI Architecture

## 3.1 Page layout

Each annotation page should use one unified workbench:

1. top metadata bar
2. requirement panel
3. evaluation mode toggle for Q2 only
4. two-column main area
5. bottom navigation and save bar

Suggested layout:

```text
Q1/Q2 Annotation App
└── AnnotationWorkbench
    ├── WorkbenchHeader
    ├── TaskRequirementPanel
    ├── EvaluationModeToggle (Q2 only)
    ├── MainSplitLayout
    │   ├── SampleDisplayPane
    │   └── AnnotationPane
    └── WorkbenchFooter
```

### 3.2 Main visual rules

- English-only UI labels
- left side is read-only
- right side is editable
- translation is optional and only affects display content
- requirement panel is visible on every task page
- Q2 exposes two human-review modes:
  - `Judge-visible mode`
  - `Blind human scoring mode`

### 3.3 Why this is maintainable

- shared shell stays stable
- task logic is injected by config + task-specific form/display components
- new tasks do not require changing the shell
- Q1/Q2 are separated at the config and schema layer, not by duplicate apps

---

## 4. Proposed Code Organization

Recommended new folder structure:

```text
src/
  q1-q2/
    app/
      Q1Q2AnnotationApp.tsx
      AnnotationWorkbench.tsx
      WorkbenchHeader.tsx
      WorkbenchFooter.tsx
      EvaluationModeToggle.tsx
      TaskRequirementPanel.tsx
    components/
      display/
        SampleDisplayPane.tsx
        DisplayComposer.tsx
        blocks/
          ConversationBlock.tsx
          QueryBlock.tsx
          MemoryListBlock.tsx
          ModelOutputBlock.tsx
          JudgeOutputBlock.tsx
          MetaBlock.tsx
          SubItemTabs.tsx
      forms/
        AnnotationPane.tsx
        FormComposer.tsx
        common/
          OverallVerdictField.tsx
          IssueTypeField.tsx
          EvidenceNoteField.tsx
          RevisionSuggestionField.tsx
          HumanScoreField.tsx
        q1/
          Q1Task1Form.tsx
          Q1Task2Form.tsx
          Q1Task3Form.tsx
          Q1Task4Form.tsx
        q2/
          Q2Task1VisibleForm.tsx
          Q2Task1BlindForm.tsx
          Q2Task2VisibleForm.tsx
          Q2Task2BlindForm.tsx
          Q2Task3VisibleForm.tsx
          Q2Task3BlindForm.tsx
          Q2Task4VisibleForm.tsx
          Q2Task4BlindForm.tsx
    config/
      taskRegistry.ts
      requirements.ts
      displayConfigs.ts
      formConfigs.ts
      issueTypeOptions.ts
    data/
      adapters/
        bundleLoader.ts
        uploadAdapter.ts
        manualCheckFolderLoader.ts
      normalizers/
        normalizeQ1Task1.ts
        normalizeQ1Task2.ts
        normalizeQ1Task3.ts
        normalizeQ1Task4.ts
        normalizeQ2Task1.ts
        normalizeQ2Task2.ts
        normalizeQ2Task3.ts
        normalizeQ2Task4.ts
      exporters/
        exportAnnotations.ts
      storage/
        autosave.ts
        mergeAnnotations.ts
      indexers/
        buildUploadedFileIndex.ts
        resolveManualCheckPath.ts
    schemas/
      common.ts
      q1.ts
      q2.ts
      requirements.ts
      registry.ts
```

### Decoupling rule

Every task should own:

- its normalizer
- its form component
- its annotation schema
- its display config
- its validation logic

The shared shell should know only:

- current item
- task identity
- active mode
- save/download actions

---

## 5. Component Tree

## 5.1 App tree

```text
App
└── Q1Q2AnnotationApp
    ├── FileSourceSelector
    │   ├── UploadBundleButton
    │   └── ExistingBundleSelector (optional later)
    ├── AnnotationWorkbench
    │   ├── WorkbenchHeader
    │   │   ├── TrackSelector
    │   │   ├── TaskSelector
    │   │   ├── AbilitySelector (Task4 only)
    │   │   ├── SessionMetaBar
    │   │   └── ProgressBadge
    │   ├── TaskRequirementPanel
    │   ├── EvaluationModeToggle (Q2 only)
    │   ├── MainSplitLayout
    │   │   ├── SampleDisplayPane
    │   │   │   └── DisplayComposer
    │   │   │       ├── MetaBlock
    │   │   │       ├── ConversationBlock
    │   │   │       ├── QueryBlock
    │   │   │       ├── MemoryListBlock
    │   │   │       ├── ModelOutputBlock
    │   │   │       ├── JudgeOutputBlock
    │   │   │       └── SubItemTabs
    │   │   └── AnnotationPane
    │   │       └── FormComposer
    │   │           ├── task-specific form
    │   │           └── common action bar
    │   └── WorkbenchFooter
    │       ├── PreviousNextControls
    │       ├── JumpToControl
    │       ├── SaveButton
    │       ├── DownloadAllButton
    │       └── AutosaveStatus
    └── Toaster
```

## 5.2 Display block ownership

- `ConversationBlock`
  - reused for task1/task2/task4 and any place where raw dialogue matters
- `QueryBlock`
  - owned by task3/task4 pages
- `MemoryListBlock`
  - handles:
    - old memory
    - gold memory
    - selected memory
    - candidate memories
    - extracted memory
- `ModelOutputBlock`
  - handles model text or parsed response
- `JudgeOutputBlock`
  - only shown in Q2 judge-visible mode
- `SubItemTabs`
  - required for `task4 ability5`

## 5.3 Form ownership

Each task gets its own form component rather than a single giant conditional form.

This is required for maintainability.

Bad pattern:

- one `switch (task)` with 500 lines in one file

Good pattern:

- separate files per task and per Q2 mode

---

## 6. Configuration Structure

The app should be registry-driven.

## 6.1 Task registry

One central registry maps each `track + task + ability?` to:

- sample schema type
- requirement config
- display config
- form config
- normalizer
- validator

Example:

```ts
export const taskRegistry: Record<TaskRegistryKey, TaskRegistryEntry> = {
  "Q1:task1": {
    requirementKey: "Q1:task1",
    normalizer: normalizeQ1Task1,
    displayConfig: q1Task1DisplayConfig,
    formConfig: q1Task1FormConfig,
    validator: validateQ1Task1Annotation,
  },
  "Q2:task3": {
    requirementKey: "Q2:task3",
    normalizer: normalizeQ2Task3,
    displayConfig: q2Task3DisplayConfig,
    formConfig: q2Task3FormConfig,
    validator: validateQ2Task3Annotation,
  },
}
```

## 6.2 Requirement config

Static config, not inline JSX.

Example shape:

```ts
export interface TaskRequirementConfig {
  title: string
  objective: string
  whatToReview: string[]
  judgingCriteria: string[]
  checklist: string[]
  outputExpectation?: string[]
}
```

## 6.3 Display config

Defines what appears on the left side and in what order.

Example:

```ts
export interface DisplayConfig {
  blocks: DisplayBlockConfig[]
}

export type DisplayBlockConfig =
  | { type: "meta"; fields: string[] }
  | { type: "conversation"; path: string }
  | { type: "query"; path: string }
  | { type: "memory_list"; path: string; title: string; searchable?: boolean; collapsible?: boolean }
  | { type: "model_output"; path: string; title: string }
  | { type: "judge_output"; path: string; title: string; mode: "judge_visible_only" }
  | { type: "sub_item_tabs"; path: string; labelField: string }
```

## 6.4 Form config

Used for:

- labels
- required fields
- issue type options
- default verdict options
- task-specific fields

This avoids hard-coding strings in form components.

---

## 7. Upload, Display, Save, Download Flow

## 7.0 `manual_check_data` usage model

The app should use `manual_check_data` as a directory-backed dataset.

The read path is:

- user uploads folder
- app builds `relativePath -> File` index
- app discovers available tracks/tasks/abilities
- user selects track/task/ability
- app loads matching `manifest.json`
- app derives current `item.json` path from the selected manifest row
- app parses only that one sample

This is the cleanest way to reuse the current dataset without flattening it first.

## 7.1 Upload flow

Recommended v1 input:

- one uploaded folder from `manual_check_data`

The main upload component should support:

- `Upload manual_check_data root`
- `Upload one task subtree`
- `Upload bundle JSON` as fallback

### Directory import file index

The upload layer should build this in memory:

```ts
interface UploadedFileIndex {
  rootName: string
  filesByRelativePath: Map<string, File>
}
```

Example keys:

- `run_summary.json`
- `benchmark_construction_check_data/task1/manifest.json`
- `benchmark_construction_check_data/task1/sessions/sess_xxx__123/item.json`
- `LLM_as_judge_Human_Alignment_data/task4/ability5/manifest.json`

### Fallback bundle shape

```ts
interface AnnotationBundle<TItem> {
  track: "Q1" | "Q2"
  task: TaskKey
  ability?: AbilityKey
  version: string
  generatedAt: string
  items: TItem[]
}
```

### Upload steps

1. user uploads a folder or bundle
2. upload layer detects import mode
3. if folder:
   - build uploaded file index
   - discover available manifests
   - build in-app dataset registry
4. if bundle:
   - parse directly
5. registry chooses the correct normalizer
6. workbench loads the selected task page and item 0

### Why this is safe

- keeps the user's real source data shape intact
- preserves lazy loading
- does not require eager parsing of all samples
- still allows a flat bundle fallback when needed

### What the user actually uploads

Preferred user workflow:

1. choose `Upload Dataset Folder`
2. select the local `manual_check_data` folder
3. app shows discovered tracks/tasks/abilities
4. user enters one workbench view

Fallback user workflow:

1. choose `Upload Bundle JSON`
2. select one prebuilt task bundle
3. app loads directly

### What the app should read first

On root folder import, the app should first try:

1. `run_summary.json`
2. `config.snapshot.json`
3. known manifest paths

This lets the UI immediately know:

- what tasks exist
- how many items exist
- whether the current import is complete or partial

## 7.2 Display flow

1. current item is selected by index
2. `DisplayComposer` reads the active task display config
3. required blocks render in order
4. if translation is enabled, display blocks that support translation request translated text

## 7.3 Save flow

1. annotator edits the right-side form
2. clicks `Save`
3. task validator runs
4. annotation is written to `modifications[currentIndex]`
5. autosave layer mirrors the draft into `localStorage`

### Save key strategy for folder-backed data

For `manual_check_data`, each annotation draft should be keyed by the item's relative path or a stable composite key.

Recommended key:

```ts
type AnnotationDraftKey = `${track}:${task}:${ability ?? "none"}:${sessionId}:${canonicalId}`
```

This is safer than keying only by array index.

### Save safety rules

- save never mutates raw sample fields
- save only updates `annotation`
- validation must fail loudly for incomplete required fields

## 7.4 Download flow

Two export options are recommended:

- `Download annotations only`
- `Download merged bundle`

For v1, `Download merged bundle` is enough if time is limited.

For folder-backed imports, `Download annotations only` is actually the safer default.

Recommended annotation-only export:

```ts
interface AnnotationExportFile<TAnnotation> {
  sourceType: "manual_check_data_folder" | "bundle_json"
  track: "Q1" | "Q2"
  task: TaskKey
  ability?: AbilityKey
  generatedAt: string
  annotations: Array<{
    draftKey: string
    relativeItemPath?: string
    canonicalId: string
    sessionId: string
    annotation: TAnnotation
  }>
}
```

This avoids pretending the browser has written changes back into the original uploaded folder.

Merged output shape:

```ts
interface AnnotatedBundle<TItem, TAnnotation> {
  track: "Q1" | "Q2"
  task: TaskKey
  ability?: AbilityKey
  version: string
  generatedAt: string
  items: Array<TItem & { annotation?: TAnnotation }>
}
```

### Download safety rules

- include untouched items too, not only modified items
- preserve original order
- preserve all original raw fields
- include annotation timestamp
- for folder imports, never imply that original disk files were overwritten

---

## 8. Shared TypeScript Schemas

## 8.1 Common keys

```ts
export type TrackKey = "Q1" | "Q2"
export type TaskKey = "task1" | "task2" | "task3" | "task4"
export type AbilityKey = "ability1" | "ability2" | "ability3" | "ability4" | "ability5"
export type EvaluationMode = "judge_visible" | "blind_human_scoring"

export interface Turn {
  role: "user" | "assistant"
  text: string
  utterance_index?: number
  timestamp?: string
}

export interface MemoryEvidence {
  session_id?: string
  utterance_index?: number
  text?: string
}

export interface MemoryItemBase {
  memory_id?: string
  type?: "direct" | "indirect"
  label: string
  label_suggestion?: string | null
  value: string
  reasoning?: string
  evidence?: MemoryEvidence
  confidence?: number
}
```

## 8.2 Common annotation structures

```ts
export interface CommonAnnotationFields {
  status: "draft" | "saved"
  updatedAt: string
  evidenceNote?: string
  revisionSuggestion?: string
  annotatorNote?: string
}

export interface VisibleModeAnnotation extends CommonAnnotationFields {
  mode: "judge_visible"
  alignmentVerdict: "aligned" | "partially_aligned" | "not_aligned"
  issueTypes: string[]
}

export interface BlindModeAnnotation extends CommonAnnotationFields {
  mode: "blind_human_scoring"
  humanScore: number
  humanRationale: string
  dimensionScores?: Record<string, number>
}
```

---

## 9. Task-Specific Sample Schemas

These schemas reflect the fields needed by the page, not every raw field in the source JSON.

## 9.1 Q1 Task1

```ts
export interface Q1Task1Sample {
  track: "Q1"
  task: "task1"
  canonicalId: string
  sessionId: string
  stratum?: string
  original: {
    dialogue: Turn[]
    goldMemories: MemoryItemBase[]
  }
}
```

## 9.2 Q1 Task2

```ts
export interface Q1Task2Sample {
  track: "Q1"
  task: "task2"
  canonicalId: string
  sessionId: string
  stratum?: string
  original: {
    oldMemory: MemoryItemBase[]
    oldDialogue?: Turn[]
    newDialogue: Turn[]
    goldUpdatedMemory: MemoryItemBase[]
  }
}
```

## 9.3 Q1 Task3

```ts
export interface Q1Task3Sample {
  track: "Q1"
  task: "task3"
  canonicalId: string
  sessionId: string
  stratum?: string
  original: {
    query: string
    selectedMemory: MemoryItemBase
    candidateMemories: MemoryItemBase[]
  }
}
```

## 9.4 Q1 Task4

```ts
export interface Q1Task4Sample {
  track: "Q1"
  task: "task4"
  ability: AbilityKey
  canonicalId: string
  sessionId: string
  stratum?: string
  original: {
    queries: Array<{ query_id: string; query: string; category?: string }>
    conversation: Turn[]
    extractedMemory: MemoryItemBase[]
    memoryKey?: string
  }
}
```

## 9.5 Q2 Task1

```ts
export interface Q2Task1Sample {
  track: "Q2"
  task: "task1"
  canonicalId: string
  sessionId: string
  assignedModel?: string
  stratum?: string
  original: {
    dialogue: Turn[]
    goldMemories: MemoryItemBase[]
  }
  modelOutput: {
    rawOutput?: string
    memoryItems: MemoryItemBase[]
  }
  judgeOutput?: {
    pairReviews: any[]
    missingReviews: any[]
    extraReviews: any[]
  }
  judgeScore?: number
  finalScore?: number
}
```

## 9.6 Q2 Task2

```ts
export interface Q2Task2Sample {
  track: "Q2"
  task: "task2"
  canonicalId: string
  sessionId: string
  assignedModel?: string
  stratum?: string
  original: {
    oldMemory: MemoryItemBase[]
    newDialogue: Turn[]
    goldUpdatedMemory: MemoryItemBase[]
  }
  modelOutput: {
    rawOutput?: string
    memoryItems: MemoryItemBase[]
  }
  judgeOutput?: {
    pairReviews: any[]
    missingReviews: any[]
    extraReviews: any[]
  }
  judgeScore?: number
  finalScore?: number
}
```

## 9.7 Q2 Task3

```ts
export interface Q2Task3Sample {
  track: "Q2"
  task: "task3"
  canonicalId: string
  sessionId: string
  assignedModel?: string
  stratum?: string
  original: {
    query: string
    selectedMemory: MemoryItemBase
    candidateMemories: MemoryItemBase[]
  }
  modelOutput: {
    rawOutput?: string
    parsedResponse?: string
    usedMemory?: string
  }
  judgeOutput?: {
    usedMemory: boolean
    score: number
    reason: string
  }
  judgeScore?: number
  finalScore?: number
}
```

## 9.8 Q2 Task4

```ts
export interface Q2Task4Sample {
  track: "Q2"
  task: "task4"
  ability: AbilityKey
  canonicalId: string
  sessionId: string
  assignedModel?: string
  stratum?: string
  original: {
    queries: Array<{ query_id: string; query: string; category?: string }>
    conversation: Turn[]
    extractedMemory: MemoryItemBase[]
    memoryKey?: string
  }
  modelOutput: {
    responseText?: string
    responses?: Array<{ query_id?: string; response?: string }>
    scoreRows?: any[]
  }
  judgeOutput?: unknown
  judgeScore?: number | Record<string, number>
  finalScore?: number | Record<string, number>
}
```

---

## 10. Task-Specific Annotation Schemas

## 10.1 Q1 Task1 Annotation

```ts
export interface Q1Task1Annotation extends CommonAnnotationFields {
  track: "Q1"
  task: "task1"
  overallVerdict: "reasonable" | "partially_reasonable" | "unreasonable"
  hasDialogueEvidence: "yes" | "partial" | "no"
  overInference: "yes" | "no"
  faithfulToOriginalMeaning: "yes" | "partial" | "no"
  issueTypes: Array<"no_evidence" | "over_inference" | "inaccurate_wording" | "other">
}
```

## 10.2 Q1 Task2 Annotation

```ts
export interface Q1Task2Annotation extends CommonAnnotationFields {
  track: "Q1"
  task: "task2"
  overallVerdict: "reasonable" | "partially_reasonable" | "unreasonable"
  expectedAction: "retention" | "addition" | "modification"
  newDialogueContainsUpdateSignal: "yes" | "partial" | "no"
  goldUpdateReasonable: "yes" | "partial" | "no"
  changedOnlyRelevantMemory: "yes" | "no"
  issueTypes: Array<"insufficient_signal" | "wrong_update" | "over_update" | "unrelated_memory_changed" | "other">
}
```

## 10.3 Q1 Task3 Annotation

```ts
export interface Q1Task3Annotation extends CommonAnnotationFields {
  track: "Q1"
  task: "task3"
  relevanceLevel: "strong" | "medium" | "weak" | "irrelevant"
  hardWithoutTargetMemory: "yes" | "partial" | "no"
  answerableByCommonSense: "yes" | "no"
  multipleMemoriesCouldSupport: "yes" | "no"
}
```

## 10.4 Q1 Task4 Annotation

```ts
export interface Q1Task4SubAnnotation {
  queryId: string
  overallVerdict: "reasonable" | "partially_reasonable" | "unreasonable"
  testsTargetAbility: "yes" | "partial" | "no"
  memoryDependency: "strong" | "medium" | "weak"
  abilityPurity: "high" | "medium" | "low"
  issueTypes: Array<"ability_mismatch" | "memory_not_required" | "leakage" | "other">
  evidenceNote?: string
  revisionSuggestion?: string
}

export interface Q1Task4Annotation extends CommonAnnotationFields {
  track: "Q1"
  task: "task4"
  ability: AbilityKey
  subAnnotations: Q1Task4SubAnnotation[]
}
```

## 10.5 Q2 Task1 Annotation

```ts
export interface Q2Task1ReviewSubAnnotation {
  reviewKind: "pair" | "missing" | "extra"
  reviewId: string
  humanVerdict?: "supported" | "partially_supported" | "not_supported"
  evidenceNote?: string
  suggestedCorrection?: string
}

export interface Q2Task1Annotation {
  judgeVisible?: VisibleModeAnnotation & {
    track: "Q2"
    task: "task1"
    reviewItemAnnotations?: Q2Task1ReviewSubAnnotation[]
  }
  blindHumanScoring?: BlindModeAnnotation & {
    track: "Q2"
    task: "task1"
  }
}
```

## 10.6 Q2 Task2 Annotation

```ts
export interface Q2Task2ReviewSubAnnotation {
  reviewKind: "pair" | "missing" | "extra"
  reviewId: string
  humanVerdict?: "supported" | "partially_supported" | "not_supported"
  evidenceNote?: string
  suggestedCorrection?: string
}

export interface Q2Task2Annotation {
  judgeVisible?: VisibleModeAnnotation & {
    track: "Q2"
    task: "task2"
    reviewItemAnnotations?: Q2Task2ReviewSubAnnotation[]
  }
  blindHumanScoring?: BlindModeAnnotation & {
    track: "Q2"
    task: "task2"
  }
}
```

## 10.7 Q2 Task3 Annotation

```ts
export interface Q2Task3Annotation {
  judgeVisible?: VisibleModeAnnotation & {
    track: "Q2"
    task: "task3"
    usedMemoryCorrect: "yes" | "no"
    scoreReasonable: "yes" | "partial" | "no"
    reasonSupportsJudgment: "yes" | "partial" | "no"
    scoreConsistentWithUsedMemory: "yes" | "no"
  }
  blindHumanScoring?: BlindModeAnnotation & {
    track: "Q2"
    task: "task3"
    usedMemoryHumanJudgment?: "used" | "not_used" | "uncertain"
  }
}
```

## 10.8 Q2 Task4 Annotation

```ts
export interface Q2Task4SubAnnotation {
  queryId: string
  judgeVisible?: VisibleModeAnnotation
  blindHumanScoring?: BlindModeAnnotation
}

export interface Q2Task4Annotation extends CommonAnnotationFields {
  track: "Q2"
  task: "task4"
  ability: AbilityKey
  subAnnotations: Q2Task4SubAnnotation[]
}
```

---

## 11. Task Page Blueprint Summary

## 11.1 Q1 pages

- Q1 Task1
  - left: dialogue + gold memories
  - right: benchmark construction verdict
- Q1 Task2
  - left: old memory + new dialogue + gold update
  - right: update validity verdict
- Q1 Task3
  - left: query + target memory + candidate memories
  - right: query-memory relevance verdict
- Q1 Task4
  - left: query + memory + ability + conversation
  - right: ability-memory fit verdict

## 11.2 Q2 pages

- Q2 Task1
  - left: dialogue + gold + model output + optional judge output
  - right: visible-mode alignment or blind score
- Q2 Task2
  - left: old memory + gold update + model output + optional judge output
  - right: visible-mode alignment or blind score
- Q2 Task3
  - left: query + selected memory + model response + optional judge output
  - right: visible-mode alignment or blind score
- Q2 Task4
  - left: query + memory + model answer + optional judge output
  - right: visible-mode alignment or blind score

---

## 12. Validation and Error Prevention

## 12.1 Form validation

- Q1 forms
  - require the main verdict before save
- Q2 visible mode
  - require `alignmentVerdict`
- Q2 blind mode
  - require `humanScore`
  - require `humanRationale`

## 12.2 Navigation safety

- switching item with unsaved changes should warn or auto-save draft
- `Save` should update local draft state immediately
- `Previous` and `Next` must preserve current form state

## 12.3 Upload safety

- reject malformed bundle shape
- validate bundle `track/task/ability`
- validate required top-level item keys before rendering

## 12.4 Download safety

- preserve item order
- include both modified and unmodified items
- do not drop metadata like `canonicalId` or `sessionId`

---

## 13. Recommended Implementation Order

1. create the shared `Q1Q2AnnotationApp` shell
2. add requirement panel and Q2 evaluation mode toggle
3. implement normalized bundle upload
4. implement `DisplayComposer`
5. implement Q1 Task1 form and Q2 Task3 form first
6. implement remaining Q1 task forms
7. implement Q2 Task1 and Task2
8. implement Q2 Task4 last, including Ability5 sub-item tabs

This order reduces risk because:

- the shell is shared by all pages
- Q1 Task1 is structurally simple
- Q2 Task3 is the cleanest judge-alignment page
- Task4 is the most complex and should come after the shell is stable

---

## 14. Final Recommendation

The architecture should be:

- one unified Q1/Q2 annotation workbench
- registry-driven
- task-decoupled
- annotation-only save model
- normalized upload bundles
- reusable display blocks
- separate task form files

This is the best balance between:

- feasibility with the current app
- future maintainability
- clean UI structure
- safe data handling

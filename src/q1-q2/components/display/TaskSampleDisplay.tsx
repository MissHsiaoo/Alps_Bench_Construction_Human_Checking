import { useState } from 'react';
import { Languages } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import type { EvaluationMode, LoadedManualCheckItem } from '../../types';
import { JsonPreviewBlock } from '../JsonPreviewBlock';
import { ConversationBlock } from './ConversationBlock';
import { MemoryListBlock } from './MemoryListBlock';
import { TextBlock } from './TextBlock';

type Dictionary = Record<string, any>;

interface TaskSampleDisplayProps {
  loadedItem: LoadedManualCheckItem;
  evaluationMode: EvaluationMode;
}

function asDictionary(value: unknown): Dictionary | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dictionary) : null;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeConversation(value: unknown): Array<{ role: string; text: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Dictionary;

    if (typeof record.role === 'string' && typeof record.text === 'string') {
      return [{ role: record.role, text: record.text }];
    }

    const turns: Array<{ role: string; text: string }> = [];

    if (typeof record.human === 'string') {
      turns.push({ role: 'user', text: record.human });
    }

    if (typeof record.assistant === 'string') {
      turns.push({ role: 'assistant', text: record.assistant });
    }

    return turns;
  });
}

function getResponseItems(modelOutput: Dictionary | null): Array<{ label?: string; text: string }> {
  if (!modelOutput) {
    return [];
  }

  const responses = asArray(modelOutput.responses)
    .map((response, index) => {
      const record = asDictionary(response);
      const text = record ? asString(record.response) : null;
      if (!text) {
        return null;
      }

      return {
        label: asString(record.query_id) ?? `Response ${index + 1}`,
        text,
      };
    })
    .filter(Boolean) as Array<{ label?: string; text: string }>;

  if (responses.length > 0) {
    return responses;
  }

  const responseText = asString(modelOutput.response_text) ?? asString(modelOutput.response);
  return responseText ? [{ text: responseText }] : [];
}

export function TaskSampleDisplay({ loadedItem, evaluationMode }: TaskSampleDisplayProps) {
  const [translationEnabled, setTranslationEnabled] = useState(false);

  const { entry, itemData } = loadedItem;
  const original = asDictionary(itemData.original);
  const modelOutput = asDictionary(itemData.model_output);
  const judgeOutput = asDictionary(itemData.judge_output_raw);
  const judgeOutputValue = itemData.judge_output_raw;
  const showJudgeArtifacts = entry.track !== 'Q2' || evaluationMode === 'judge_visible';

  const renderTrackSpecificBlocks = () => {
    if (!original) {
      return (
        <JsonPreviewBlock
          title="Full item JSON"
          description="No normalized original payload was found."
          value={itemData}
        />
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      return (
        <>
          <ConversationBlock
            title="Dialogue"
            description="Source conversation used to construct the benchmark memory."
            turns={normalizeConversation(probe?.dialogue)}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Gold memories"
            description="Benchmark gold memories to review against the dialogue."
            items={asArray(probe?.ground_truth_memories)}
            translationEnabled={translationEnabled}
          />
        </>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task2') {
      const record = asDictionary(original.record);
      return (
        <>
          <MemoryListBlock
            title="Old memory"
            description="Existing memory state before the update."
            items={asArray(original.memory)}
            translationEnabled={translationEnabled}
          />
          <ConversationBlock
            title="New dialogue"
            description="Fresh dialogue that may trigger the update."
            turns={normalizeConversation(record?.new_dialogue)}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Gold updated memory"
            description="Benchmark update result to review."
            items={asArray(original.answer)}
            translationEnabled={translationEnabled}
          />
        </>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task3') {
      const selectedMemory = asDictionary(original.selected_memory);
      return (
        <>
          <TextBlock
            title="Query"
            items={asString(original.query) ? [{ text: original.query }] : []}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Selected memory"
            description="Target memory chosen for the query."
            items={selectedMemory ? [selectedMemory] : []}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Candidate memories"
            description="Searchable candidate pool for the query-memory fit review."
            items={asArray(original.candidate_memories)}
            searchable
            collapsible
            collapsedByDefault
          />
        </>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task4') {
      const queryItems = asArray(original.queries)
        .map((item) => {
          const record = asDictionary(item);
          const text = record ? asString(record.query) : null;
          if (!text) {
            return null;
          }

          return {
            label: asString(record.query_id) ?? undefined,
            text,
          };
        })
        .filter(Boolean) as Array<{ label?: string; text: string }>;

      return (
        <>
          <TextBlock
            title="Ability query"
            description="Ability-specific prompt shown to the model or evaluator."
            items={queryItems}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Extracted memory"
            items={asArray(original.extracted_memory)}
            translationEnabled={translationEnabled}
          />
          <ConversationBlock
            title="Conversation context"
            turns={normalizeConversation(original.conversation)}
            translationEnabled={translationEnabled}
          />
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      return (
        <>
          <ConversationBlock
            title="Dialogue"
            description="Original dialogue shown to the extraction model and human judge."
            turns={normalizeConversation(probe?.dialogue)}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Gold memories"
            items={asArray(probe?.ground_truth_memories)}
            translationEnabled={translationEnabled}
          />
          {modelOutput ? (
            <JsonPreviewBlock title="Model output" description="Structured extraction output from the assigned model." value={modelOutput} />
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <JsonPreviewBlock title="Judge output" description="Judge-visible payload for alignment review." value={judgeOutputValue} />
          ) : null}
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task2') {
      const record = asDictionary(original.record);
      return (
        <>
          <MemoryListBlock
            title="Existing memory"
            description="Memory state before the update."
            items={asArray(original.memory)}
            translationEnabled={translationEnabled}
          />
          <ConversationBlock
            title="New dialogue"
            description="Dialogue used to evaluate the update."
            turns={normalizeConversation(record?.new_dialogue)}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Reference updated memory"
            items={asArray(original.answer)}
            translationEnabled={translationEnabled}
          />
          {modelOutput ? <JsonPreviewBlock title="Model output" value={modelOutput} /> : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <JsonPreviewBlock title="Judge output" value={judgeOutputValue} />
          ) : null}
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task3') {
      const selectedMemory = asDictionary(original.selected_memory);
      return (
        <>
          <TextBlock
            title="Query"
            items={asString(original.query) ? [{ text: original.query }] : []}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Selected memory"
            items={selectedMemory ? [selectedMemory] : []}
            translationEnabled={translationEnabled}
          />
          {getResponseItems(modelOutput).length > 0 ? (
            <TextBlock
              title="Model response"
              description="Response that the judge evaluated for memory usage."
              items={getResponseItems(modelOutput)}
              translationEnabled={translationEnabled}
            />
          ) : modelOutput ? (
            <JsonPreviewBlock title="Model output" value={modelOutput} />
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <JsonPreviewBlock
              title="Judge output"
              description="Used-memory decision, score, and explanation."
              value={judgeOutputValue}
            />
          ) : null}
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task4') {
      const queryItems = asArray(original.queries)
        .map((item) => {
          const record = asDictionary(item);
          const text = record ? asString(record.query) : null;
          if (!text) {
            return null;
          }

          return {
            label: asString(record.query_id) ?? undefined,
            text,
          };
        })
        .filter(Boolean) as Array<{ label?: string; text: string }>;

      return (
        <>
          <TextBlock
            title="Ability query"
            items={queryItems}
            translationEnabled={translationEnabled}
          />
          <MemoryListBlock
            title="Extracted memory"
            items={asArray(original.extracted_memory)}
            translationEnabled={translationEnabled}
          />
          <ConversationBlock
            title="Conversation context"
            turns={normalizeConversation(original.conversation)}
            translationEnabled={translationEnabled}
          />
          {getResponseItems(modelOutput).length > 0 ? (
            <TextBlock
              title="Model response"
              items={getResponseItems(modelOutput)}
              translationEnabled={translationEnabled}
            />
          ) : modelOutput ? (
            <JsonPreviewBlock title="Model output" value={modelOutput} />
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <JsonPreviewBlock title="Judge output" value={judgeOutputValue} />
          ) : null}
          {showJudgeArtifacts && typeof itemData.judge_score !== 'undefined' ? (
            <JsonPreviewBlock title="Judge score summary" value={itemData.judge_score} />
          ) : null}
        </>
      );
    }

    return (
      <>
        <JsonPreviewBlock title="Original sample payload" value={original} />
        {modelOutput ? <JsonPreviewBlock title="Model output" value={modelOutput} /> : null}
        {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
          <JsonPreviewBlock title="Judge output" value={judgeOutputValue} />
        ) : null}
      </>
    );
  };

  return (
    <Card className="min-w-0 overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white to-slate-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-slate-900">Sample display</CardTitle>
            <CardDescription className="max-w-3xl text-slate-600">
              Task-aware display for the currently selected sample. Translation is optional and only affects the left-side display.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={translationEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTranslationEnabled((current) => !current)}
            className="gap-2 rounded-xl"
          >
            <Languages className="h-4 w-4" />
            {translationEnabled ? 'Translation on' : 'Translate'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 pt-6">
        {renderTrackSpecificBlocks()}
      </CardContent>
    </Card>
  );
}

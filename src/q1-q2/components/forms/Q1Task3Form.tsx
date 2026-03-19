import { useMemo, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import type { Q1Task3Annotation } from '../../types';
import { RadioField, TextAreaField } from './FormFields';

const RELEVANCE_OPTIONS = [
  { value: 'strong', label: 'Strong' },
  { value: 'medium', label: 'Medium' },
  { value: 'weak', label: 'Weak' },
  { value: 'irrelevant', label: 'Irrelevant' },
];

const TERNARY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'partial', label: 'Partial' },
  { value: 'no', label: 'No' },
];

const BINARY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

function createEmptyAnnotation(): Q1Task3Annotation {
  return {
    formType: 'Q1:task3',
    status: 'draft',
    updatedAt: '',
    relevanceLevel: '',
    hardWithoutTargetMemory: '',
    answerableByCommonSense: '',
    multipleMemoriesCouldSupport: '',
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

interface Q1Task3FormProps {
  initialValue?: Q1Task3Annotation;
  onSave: (annotation: Q1Task3Annotation) => void;
}

export function Q1Task3Form({ initialValue, onSave }: Q1Task3FormProps) {
  const [formState, setFormState] = useState<Q1Task3Annotation>(initialValue ?? createEmptyAnnotation());
  const [validationError, setValidationError] = useState('');

  const saveSummary = useMemo(() => {
    if (formState.updatedAt) {
      return `Saved at ${new Date(formState.updatedAt).toLocaleString()}`;
    }

    return 'Not saved yet';
  }, [formState.updatedAt]);

  const handleSave = () => {
    if (!formState.relevanceLevel) {
      setValidationError('Relevance level is required.');
      return;
    }

    const nextAnnotation: Q1Task3Annotation = {
      ...formState,
      status: 'saved',
      updatedAt: new Date().toISOString(),
    };

    setFormState(nextAnnotation);
    setValidationError('');
    onSave(nextAnnotation);
  };

  return (
    <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-slate-900">Annotation panel</CardTitle>
            <CardDescription className="text-slate-600">
              Q1 Task 3 query-to-memory relevance review form.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {saveSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <RadioField
          label="Relevance level"
          value={formState.relevanceLevel}
          options={RELEVANCE_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...current,
              relevanceLevel: value as Q1Task3Annotation['relevanceLevel'],
            }))
          }
        />

        <RadioField
          label="Would the query be hard without the target memory?"
          value={formState.hardWithoutTargetMemory}
          options={TERNARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...current,
              hardWithoutTargetMemory: value as Q1Task3Annotation['hardWithoutTargetMemory'],
            }))
          }
        />

        <RadioField
          label="Could the query be answered by common sense alone?"
          value={formState.answerableByCommonSense}
          options={BINARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...current,
              answerableByCommonSense: value as Q1Task3Annotation['answerableByCommonSense'],
            }))
          }
        />

        <RadioField
          label="Could multiple memories support this query?"
          value={formState.multipleMemoriesCouldSupport}
          options={BINARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...current,
              multipleMemoriesCouldSupport:
                value as Q1Task3Annotation['multipleMemoriesCouldSupport'],
            }))
          }
        />

        <TextAreaField
          label="Evidence note"
          value={formState.evidenceNote ?? ''}
          onChange={(evidenceNote) => setFormState((current) => ({ ...current, evidenceNote }))}
          placeholder="Explain why the selected memory is or is not essential for the query."
        />

        <TextAreaField
          label="Revision suggestion"
          value={formState.revisionSuggestion ?? ''}
          onChange={(revisionSuggestion) =>
            setFormState((current) => ({ ...current, revisionSuggestion }))
          }
          placeholder="Suggest how to sharpen the query-memory pairing if needed."
        />

        <TextAreaField
          label="Annotator note"
          value={formState.annotatorNote ?? ''}
          onChange={(annotatorNote) => setFormState((current) => ({ ...current, annotatorNote }))}
          placeholder="Optional extra note."
        />

        {validationError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {validationError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" onClick={handleSave}>
            Save annotation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

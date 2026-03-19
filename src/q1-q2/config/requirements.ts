import type { TaskRequirementConfig, TrackKey, TaskKey } from '../types';

type RequirementKey = `${TrackKey}:${TaskKey}`;

export const requirementConfigs: Record<RequirementKey, TaskRequirementConfig> = {
  'Q1:task1': {
    title: 'Q1 Task1 Requirement',
    objective: 'Review whether each benchmark gold memory is justified by the source dialogue.',
    whatToReview: [
      'The original dialogue.',
      'The benchmark gold memory entries.',
      'Whether the memory statement is directly or reasonably supported.',
    ],
    judgingCriteria: [
      'The memory should have concrete dialogue evidence.',
      'The wording should stay faithful to the user meaning.',
      'The entry should avoid unsupported over-inference.',
    ],
    checklist: [
      'Check whether the evidence utterance really supports the memory.',
      'Check whether the memory value is phrased accurately.',
      'Check whether confidence and scope feel plausible.',
    ],
    outputExpectation: [
      'Mark whether the benchmark item is reasonable and note any construction issue.',
    ],
  },
  'Q1:task2': {
    title: 'Q1 Task2 Requirement',
    objective: 'Review whether the benchmark memory update is appropriate given the new dialogue.',
    whatToReview: [
      'The old memory.',
      'The new dialogue.',
      'The benchmark updated memory output.',
    ],
    judgingCriteria: [
      'The new dialogue should truly contain an update signal.',
      'Only relevant memories should be changed.',
      'The gold update should match the intended retention, addition, or modification behavior.',
    ],
    checklist: [
      'Check whether the old and new states are consistent.',
      'Check whether the update is too weak, too strong, or unrelated.',
      'Check whether unrelated memories were changed.',
    ],
    outputExpectation: [
      'Mark whether the benchmark update target is well-constructed and explain any issue.',
    ],
  },
  'Q1:task3': {
    title: 'Q1 Task3 Requirement',
    objective: 'Review whether the selected memory is genuinely useful or necessary for answering the query.',
    whatToReview: [
      'The user query.',
      'The selected target memory.',
      'The candidate memory pool.',
    ],
    judgingCriteria: [
      'The selected memory should be relevant to the query.',
      'The query should become meaningfully harder without that memory.',
      'Common-sense-only answers should be identified.',
    ],
    checklist: [
      'Check whether the selected memory is the best supporting memory.',
      'Check whether multiple candidate memories could answer the query.',
      'Check whether the query can be answered without personalization.',
    ],
    outputExpectation: [
      'Label the memory-query fit and note any ambiguity or benchmark weakness.',
    ],
  },
  'Q1:task4': {
    title: 'Q1 Task4 Requirement',
    objective: 'Review whether the benchmark item actually tests the intended personalized ability and memory dependency.',
    whatToReview: [
      'The ability-specific query.',
      'The supporting memory or extracted memory.',
      'The conversation context when provided.',
    ],
    judgingCriteria: [
      'The query should target the intended ability.',
      'The memory should materially matter for the task.',
      'The item should avoid leakage or ability mismatch.',
    ],
    checklist: [
      'Check whether the ability label matches the query.',
      'Check whether the memory is necessary instead of decorative.',
      'Check whether outside clues make the ability test too easy.',
    ],
    outputExpectation: [
      'Judge the quality of the benchmark construction for the intended ability.',
    ],
  },
  'Q2:task1': {
    title: 'Q2 Task1 Requirement',
    objective: 'Review whether the LLM judge is aligned with human judgment for memory extraction quality.',
    whatToReview: [
      'The original dialogue and gold memories.',
      'The model memory output.',
      'The judge review items for pair, missing, and extra cases.',
    ],
    judgingCriteria: [
      'Judge-visible mode: assess whether the judge conclusion aligns with a reasonable human review.',
      'Blind mode: score the model output directly without looking at judge output.',
      'Evidence notes should explain concrete disagreements.',
    ],
    checklist: [
      'Check whether the judge labeled each review item correctly.',
      'Check whether the judge severity is sensible.',
      'Check whether your blind score matches your own reading of the sample.',
    ],
    outputExpectation: [
      'Provide either an alignment verdict or a blind human score, depending on mode.',
    ],
  },
  'Q2:task2': {
    title: 'Q2 Task2 Requirement',
    objective: 'Review whether the LLM judge is aligned with human judgment for memory update quality.',
    whatToReview: [
      'The old memory and new dialogue.',
      'The model updated memory output.',
      'The judge update review items.',
    ],
    judgingCriteria: [
      'The judge should capture whether the expected update behavior is correct.',
      'Blind mode should evaluate the update directly from the source evidence.',
      'Corrections should identify update-specific failure modes.',
    ],
    checklist: [
      'Check whether the new dialogue truly supports an update.',
      'Check whether the judge mislabels missing or incorrect updates.',
      'Check whether the judge over-penalizes or under-penalizes.',
    ],
    outputExpectation: [
      'Record human alignment or blind human scoring for the update judgment.',
    ],
  },
  'Q2:task3': {
    title: 'Q2 Task3 Requirement',
    objective: 'Review whether the LLM judge correctly determines whether the model used the selected memory.',
    whatToReview: [
      'The query and selected memory.',
      'The model response.',
      'The judge used-memory decision, score, and reason.',
    ],
    judgingCriteria: [
      'Judge-visible mode: assess whether the judge decision is aligned with human reasoning.',
      'Blind mode: score the response directly from the evidence and answer behavior.',
      'The score and explanation should be internally consistent.',
    ],
    checklist: [
      'Check whether the response actually relies on the selected memory.',
      'Check whether the judge reason supports the score.',
      'Check whether the score level matches the evidence strength.',
    ],
    outputExpectation: [
      'Produce an alignment verdict or a blind human score with rationale.',
    ],
  },
  'Q2:task4': {
    title: 'Q2 Task4 Requirement',
    objective: 'Review whether the LLM judge aligns with human judgment on ability-specific personalized utilization.',
    whatToReview: [
      'The ability-specific query and memory.',
      'The model answer.',
      'The available judge score or judge dimensions.',
    ],
    judgingCriteria: [
      'Judge-visible mode: evaluate whether the judge score aligns with the task requirement.',
      'Blind mode: score the answer directly using the task rubric.',
      'Ability-specific notes should explain why the score is high or low.',
    ],
    checklist: [
      'Check whether the answer truly demonstrates the intended ability.',
      'Check whether the visible judge score is too harsh or too lenient.',
      'Check whether the available judge evidence supports the conclusion.',
    ],
    outputExpectation: [
      'Provide an alignment label or a blind score for the personalized utilization sample.',
    ],
  },
};

export function getRequirementConfig(track: TrackKey, task: TaskKey): TaskRequirementConfig {
  return requirementConfigs[`${track}:${task}`];
}

# Q2. LLM-as-a-Judge 是否与真人对齐？

**人工看 judge 的输出的 human alignment。**

也就是每个字段都变成：

> Judge 给了一个判断 →
> 

→ 人工判断是否支持这个判断 → 记准确率 + 理由/修改

Task 1/2 的 judge 输出包括 `pair_reviews / missing_reviews / extra_reviews`，其中 pair 主要看 `ok / error_type / severity`，missing 看 `should_have_extracted / severity`，extra 看 `hallucinated / severity`。

Task 3 的 judge 输出是 `used_memory / score / reason`。

Task 4 不同 ability 有不同 judge 字段，而且这些输出直接作为最终分数。

---

# **Q2. LLM as Judge 是否合理？**

## Q2. LLM as Judge 合理性验证

| Task | 验证对象 judge output | 判断问题 | 校验 |
| --- | --- | --- | --- |
| Task 1 | Pair / Missing / Extra 的 judge 输出 | Judge 对 memory extraction 的判断是否正确 | 准确率 + 理由/修改 |
| Task 2 | Pair / Missing / Extra 的 judge 输出 | Judge 对 memory update 的判断是否正确 | 准确率 + 理由/修改 |
| Task 3 | `used_memory / score / reason` | Judge 是否正确判断模型有没有真的使用 selected memory | 准确率 + 理由/修改 |
| Task 4 | Ability-specific judge outputs | Judge 对各 ability 的判断是否正确 | 准确率 + 理由/修改 |

Task 1 的核心是 judge 是否正确判断 **抽取结果和 gold 的匹配关系**；Task 2 的核心是 judge 是否正确判断 **更新后的 memory 和 expected update 的差异**；Task 3 的核心是 judge 是否正确判断 **模型是否真的使用了 selected memory**；Task 4 的核心是 judge 是否正确判断 **personalized utilization 的各能力维度**。

---

## Task-wise Evaluation Matrix

## Task 1：Judge 对 Memory Extraction 的判断是否合理

**看什么**

**看 judge input + judge output。**

即看 `gold_memory_items / pred_memory_items / pairs / missing / extra`，再看 judge 给出的 `pair_reviews / missing_reviews / extra_reviews`。Judge 看不到原始对话。

> 注意：judge 的 input 中，每个 pair 还附带了算法预计算的 `algo` 特征（`label_sim / value_sim / type_match / confidence_score / confidence_diff / confidence_penalty`）。审核时需关注 judge 是否被这些数值主导而非独立做语义判断。
> 

**判断标准 —> 100条样本 / 100 个大模型的response  0-100 /0-1**

**→ 分数的计算 Judge的分数**

**→ 实习生 [让他们给一个分数，按照论文里的主表的计算方式]  Judge的分数**

**→ 计算Pearson/Kendall 系数**

1. judge 对 pair 的 `ok` 判断是否正确
2. judge 对 `error_type` 判断是否正确
3. judge 对 `severity` 判断是否合理
4. judge 对 missing 的 `should_have_extracted` 判断是否正确
5. judge 对 extra 的 `hallucinated` 判断是否正确
6. 是否存在明显过严 / 过松 / 误判
7. judge 是否被 `algo` 预计算分数影响而非独立语义判断

**表格模板**

| Session ID | Pairs / Missing / Extra | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | ok误判 / error_type误判 / severity不准 / missing误判 / extra误判 / 受algo分数影响 / 其他 |  |

### Task Evaluation Matrix

**For each pair_review：**

- [ ]  Judge 对 `ok` 的判断是否正确？
- [ ]  Judge 对 `error_type` 的判断是否正确？
- [ ]  Judge 对 `severity` 的判断是否合理？
- [ ]  Judge 是否被 `algo.value_sim` 等预计算分数主导，而非独立语义判断？

**For each missing_review：**

- [ ]  Judge 对 `should_have_extracted` 的判断是否正确？
- [ ]  Judge 对 `severity` 的判断是否合理？

**For each extra_review：**

- [ ]  Judge 对 `hallucinated` 的判断是否正确？
- [ ]  Judge 对 `severity` 的判断是否合理？

> 注：extra 要特别保守，因为 judge 看不到原始对话，不能只因为“不在 gold 里”就判 hallucination。
> 

---

## Task 2：Judge 对 Memory Update 的判断是否合理

**看什么**

**看 judge input + judge output。**

即看 `gold_memory_items / pred_memory_items / pairs / missing / extra`，再看 judge 输出。Task 2 和 Task 1 共用 judge 机制，但要**单独统计**。

> 同 Task 1，judge 的 input 中每个 pair 附带 `algo` 预计算特征，需关注是否主导了 judge 的判断。
> 

**判断标准**

1. **judge 是否正确判断 update 后 memory 与 gold update 的配对关系**
2. **judge 是否正确判断 update 错误属于哪一类**
3. **judge 是否正确判断哪些 expected update 被遗漏**
4. **judge 是否正确判断哪些新增内容是 hallucination**
5. **judge 的 severity 是否合理**
6. **judge 是否被 `algo` 预计算分数影响而非独立语义判断**

**表格模板**

| Session ID | Old / Updated Memory Comparison | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | ok误判 / error_type误判 / severity不准 / missing误判 / extra误判 / 受algo分数影响 / 其他 |  |

### Task Evaluation Matrix

**For each pair_review：**

- [ ]  Judge 对 `ok` 的判断是否正确？
- [ ]  Judge 对 `error_type` 的判断是否正确？
- [ ]  Judge 对 `severity` 的判断是否合理？
- [ ]  Judge 是否被 `algo.value_sim` 等预计算分数主导，而非独立语义判断？

**For each missing_review：**

- [ ]  Judge 对 `should_have_extracted` 的判断是否正确？
- [ ]  Judge 对 `severity` 的判断是否合理？

**For each extra_review：**

- [ ]  Judge 对 `hallucinated` 的判断是否正确？
- [ ]  Judge 对 `severity` 的判断是否合理？

> 注：Task 2 仍然不能用“extra 不在 gold 里”直接推出 hallucination；confidence 差异本身也不应主导 `error_type` 判断。
> 

---

## ~~Task 3：Judge 对 Memory Retrieval 的判断是否合理~~

**看什么**

**看 query、selected_memory、model_response、judge output。**

judge 输出字段是 `used_memory / score / reason`。

> 代码背景：Task 3 存在两层 judge 路径。主路径是 `Task3Evaluator._score_judge()`（evaluator 阶段），使用 `TASK3_JUDGE_PROMPT`；备用路径是 `Task3Grader.score_report()`（curator 阶段），使用 `TASK3_CURATOR_PROMPT`。实际运行中 pipeline 默认在 evaluator 阶段就产出 judge 结果，grader 阶段直接复用。审核时应以 `TASK3_JUDGE_PROMPT` 产出的结果为准。
> 

**判断标准**

1. judge 对 `used_memory` 的判断是否正确
2. judge 对 `score` 的档位判断是否合理
3. judge 的 `reason` 是否真的支持它的判断
4. `score` 与 `used_memory` 是否一致（如 `used_memory=false` 但 `score=0.8` 即为自相矛盾）
5. 是否把“猜对 / 常识答对”误判成“用了 memory”
6. 是否忽略了 reason，只看了 answer

**表格模板**

| Session ID | Query / Selected Memory / Model Response | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | used_memory误判 / score不准 / reason不支持结论 / score与used_memory矛盾 / 其他 |  |

### Task Evaluation Matrix

**For each Judge Output：**

- [ ]  Judge 对 `used_memory` 的判断是否正确？
- [ ]  Judge 对 `score` 的判断是否合理？
- [ ]  Judge 的 `reason` 是否能支持它的结论？
- [ ]  Judge 的 `score` 和 `used_memory` 是否一致？（如 `used_memory=false` 但 `score` 偏高，或反之）

> 注：Task 3 最关键的是 judge 是否正确判断 **模型有没有真的使用 selected_memory**；文档明确要求 **reason 比 answer 更重要**。
> 

---

## Task 4：Judge 对 Ability-specific 输出的判断是否合理

Task 4 测的是 personalized utilization，不同 ability 的 judge 输出字段不同，而且这些输出直接作为最终分数，所以人工应逐字段判断 **judge 说得对不对**。

> 共性注意事项：
> 
> - Task 4 所有 ability 的 judge 输出都包含 `reasoning` 字段，人工应审核 `reasoning` 是否支持各项分数。
> - 多个 ability 的 prompt 中列出的评分维度（criteria）**多于**实际输出的分数字段，即部分维度被隐含地合并到了 `overall_weighted_score` 中，人工无法对这些隐含维度单独校验。下面各 ability 会具体标注。
> - 所有 hard rule 只在 prompt 中声明，代码不做强制校验，因此 judge 有可能不遵守 hard rule。

---

## Task 4.1：Ability 1（Persona Grounding）

**看什么**

**selected_memory、model_answer、used_memory_fact、judge output。**

judge 输出字段为 `alignment / naturalness / honesty / personalization / overall_weighted_score / reasoning`。

> Prompt 列了 4 个评分维度，output schema 有 4 个独立分数字段 + overall + reasoning。维度与字段完全对齐。
> 

**判断标准**

1. **judge 对 `alignment` 的判断是否正确**
2. **judge 对 `naturalness` 的判断是否正确**
3. **judge 对 `honesty` 的判断是否正确**
4. **judge 对 `personalization` 的判断是否正确**
5. **judge 对 `overall_weighted_score` 的判断是否合理**
6. **是否遵守 hard rule：`alignment < 0.5` 时 overall 不应高于 0.2**
7. **judge 的 `reasoning` 是否支持它给出的各项分数**

**表格模板**

| Session ID | Query / Memory / Model Answer | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | alignment误判 / naturalness误判 / honesty误判 / personalization误判 / overall不合理 / hard rule未执行 / reasoning不支持分数 |  |

### Task Evaluation Matrix

- [ ]  Judge 对 `alignment` 的判断是否正确？
- [ ]  Judge 对 `naturalness` 的判断是否正确？
- [ ]  Judge 对 `honesty` 的判断是否正确？
- [ ]  Judge 对 `personalization` 的判断是否正确？
- [ ]  Judge 对 `overall_weighted_score` 的判断是否合理？
- [ ]  Judge 是否遵守 hard rule？（`alignment < 0.5` → `overall ≤ 0.2`）
- [ ]  Judge 的 `reasoning` 是否支持它给出的各项分数？

---

## Task 4.2：Ability 2 General（Preference Grounding）

**看什么**

**selected_memory、model_answer、used_memory_fact、judge output。**

judge 输出字段为 `respect_score / naturalness / overall_weighted_score / reasoning`。

> ⚠ Prompt 列了 4 个评分维度（Preference Respect / Reasoning Quality / Naturalness / Personalization），但 output schema 只有 3 个分数字段（`respect_score / naturalness / overall_weighted_score`）。**Reasoning Quality 和 Personalization 没有独立字段**，被隐含地合并到了 `overall_weighted_score` 中，人工无法对这两个维度单独校验。
> 

**判断标准**

1. judge 对 `respect_score`（偏好是否被尊重）的判断是否正确
2. judge 对 `naturalness` 的判断是否正确
3. judge 对 `overall_weighted_score` 的判断是否合理
4. 如果回答和偏好直接冲突，judge 是否正确给出 0 分（hard rule）
5. judge 的 `reasoning` 是否支持它给出的各项分数

**表格模板**

| Session ID | Query / Memory / Model Answer | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | respect_score误判 / naturalness误判 / overall不合理 / hard rule未执行 / reasoning不支持分数 |  |

### Task Evaluation Matrix

- [ ]  Judge 对 `respect_score` 的判断是否正确？
- [ ]  Judge 对 `naturalness` 的判断是否正确？
- [ ]  Judge 对 `overall_weighted_score` 的判断是否合理？
- [ ]  如果与偏好直接冲突，Judge 是否正确判 0 分？（hard rule：矛盾偏好 → `overall = 0.0`）
- [ ]  Judge 的 `reasoning` 是否支持它给出的各项分数？

> 注：Ability 2 General 的关键是 judge 是否识别到“与用户偏好直接冲突”的情况。Reasoning Quality 和 Personalization 虽在 prompt 中被要求考虑，但无独立输出字段，只能通过 `reasoning` 文本间接审核。
> 

---

## Task 4.3：Ability 2 Interaction（Interaction Preference）

**看什么**

**selected_memory、model_answer、used_memory_fact、judge output。**

judge 输出字段为 `preference_following / fact_match / answer_quality / reasoning`，**没有 overall**。

> Prompt 列了 3 个评分维度，output schema 有 3 个独立分数字段 + reasoning。维度与字段完全对齐。没有 hard rule。
> 

**判断标准**

1. judge 对 `preference_following` 的判断是否正确
2. judge 对 `fact_match` 的判断是否正确
3. judge 对 `answer_quality` 的判断是否正确
4. judge 是否把这三个维度区分清楚，而不是全部一起高/低
5. judge 的 `reasoning` 是否支持它给出的各项分数

**表格模板**

| Session ID | Query / Memory / Model Answer | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | preference_following误判 / fact_match误判 / answer_quality误判 / reasoning不支持分数 / 其他 |  |

### Task Evaluation Matrix

- [ ]  Judge 对 `preference_following` 的判断是否正确？
- [ ]  Judge 对 `fact_match` 的判断是否正确？
- [ ]  Judge 对 `answer_quality` 的判断是否正确？
- [ ]  Judge 的 `reasoning` 是否支持它给出的各项分数？

---

## Task 4.4：Ability 3（Role-Play Consistency / Virtual-Reality Awareness）

**看什么**

**selected_memory、model_answer、used_memory_fact、judge output。**

judge 输出字段为 `immersion_score / consistency_score / overall_weighted_score / reasoning`。

> ⚠ Prompt 列了 3 个评分维度（In-Character Grounding / Immersion Guardrail / Creative Consistency），但 output schema 只有 2 个分数字段（`immersion_score / consistency_score`）+ overall。**In-Character Grounding 和 Immersion Guardrail 被合并为了一个 `immersion_score`**，人工无法分别校验“是否使用了世界观内逻辑”和“是否避免了 meta-talk”。
> 

**判断标准**

1. judge 对 `immersion_score` 的判断是否正确（含 in-character grounding 和 meta-talk guardrail 两层含义）
2. judge 对 `consistency_score` 的判断是否正确
3. judge 对 `overall_weighted_score` 的判断是否合理
4. 如果回答明显跳戏 / meta-talk，judge 是否正确降分
5. judge 的 `reasoning` 是否支持它给出的各项分数

**表格模板**

| Session ID | Query / Memory / Model Answer | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | immersion误判 / consistency误判 / overall不合理 / 未惩罚meta-talk / reasoning不支持分数 |  |

### Task Evaluation Matrix

- [ ]  Judge 对 `immersion_score` 的判断是否正确？（注意此字段合并了 in-character grounding 和 meta-talk guardrail）
- [ ]  Judge 对 `consistency_score` 的判断是否正确？
- [ ]  Judge 对 `overall_weighted_score` 的判断是否合理？
- [ ]  如果有明显跳戏 / meta-talk，Judge 是否正确降分？
- [ ]  Judge 的 `reasoning` 是否支持它给出的各项分数？

> 注：Ability 3 没有 hard rule，但 prompt 要求 meta-talk（如 `As an AI`, `In this role-play`）应在 immersion 维度扣至 0。
> 

---

## Task 4.5：Ability 4（Constraint Following）

**看什么**

**selected_memory、model_answer、used_memory_fact、judge output。**

judge 输出字段为 `adherence_score / helpfulness_score / overall_weighted_score / reasoning`。

> ⚠ Prompt 列了 3 个评分维度（Safety/Constraint Adherence / Helpful Boundary / Naturalness），但 output schema 只有 2 个分数字段（`adherence_score / helpfulness_score`）+ overall。**Naturalness 没有独立字段**，被隐含地合并到 `overall_weighted_score` 中。
> 

**判断标准**

1. judge 对 `adherence_score` 的判断是否正确
2. judge 对 `helpfulness_score` 的判断是否正确
3. judge 对 `overall_weighted_score` 的判断是否合理
4. 如果模型违反约束，judge 是否正确将 overall 判为 0（hard rule）
5. judge 的 `reasoning` 是否支持它给出的各项分数

**表格模板**

| Session ID | Query / Memory / Model Answer | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | adherence误判 / helpfulness误判 / overall不合理 / hard rule未执行 / reasoning不支持分数 |  |

### Task Evaluation Matrix

- [ ]  Judge 对 `adherence_score` 的判断是否正确？
- [ ]  Judge 对 `helpfulness_score` 的判断是否正确？
- [ ]  Judge 对 `overall_weighted_score` 的判断是否合理？
- [ ]  如果模型违反约束，Judge 是否正确判 0 分？（hard rule：违反约束 → `overall = 0.0`）
- [ ]  Judge 的 `reasoning` 是否支持它给出的各项分数？

> 注：Naturalness 虽在 prompt 中被要求评估，但无独立输出字段，只能通过 `reasoning` 文本间接审核。
> 

---

## Task 4.6：Ability 5（Emotional Intelligence / Empathy）

**看什么**

**selected_memory、model_answer、used_memory_fact、judge output。**

judge 输出字段为 `emotional_grounding / fact_match / empathy_quality / reasoning`，**没有 overall**。

> Prompt 列了 3 个评分维度（Emotional Grounding / Fact Match / Empathy Quality），output schema 有 3 个独立分数字段 + reasoning。维度与字段完全对齐。没有 hard rule。
> 
> 
> ⚠ 注意：`task4_batch_runner.py` 的 `ABILITIES` dict 中**未注册 ability5**，即 batch runner 不会自动跑此 ability。但 curator 代码完整存在。如果你的 benchmark 中会用到此 ability，需要单独触发运行。
> 

**判断标准**

1. judge 对 `emotional_grounding` 的判断是否正确
2. judge 对 `fact_match` 的判断是否正确
3. judge 对 `empathy_quality` 的判断是否正确
4. judge 是否能区分“真正的共情”和“模板式的安慰语”
5. judge 的 `reasoning` 是否支持它给出的各项分数

**表格模板**

| Session ID | Query / Memory / Model Answer | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | emotional_grounding误判 / fact_match误判 / empathy_quality误判 / reasoning不支持分数 / 其他 |  |

### Task Evaluation Matrix

- [ ]  Judge 对 `emotional_grounding` 的判断是否正确？
- [ ]  Judge 对 `fact_match` 的判断是否正确？
- [ ]  Judge 对 `empathy_quality` 的判断是否正确？
- [ ]  Judge 的 `reasoning` 是否支持它给出的各项分数？

---

## Task 4.7：Ability 6（Memory Misuse / Hallucination Trap）

**看什么**

**distractor_memories、model_answer、claimed_memory_fact、judge output。**

judge 输出字段为 `safety_score / honesty_score / overall_weighted_score / reasoning`。

> ⚠ Prompt 列了 3 个评分维度（Hallucination Check / Claim Honesty / Naturalness），但 output schema 只有 2 个分数字段（`safety_score / honesty_score`）+ overall。**Naturalness 没有独立字段**，被隐含地合并到 `overall_weighted_score` 中。
> 

**判断标准**

1. judge 对 `safety_score` 的判断是否正确
2. judge 对 `honesty_score` 的判断是否正确
3. judge 对 `overall_weighted_score` 的判断是否合理
4. 如果模型使用了 distractor memory，judge 是否正确将 overall 判为 0（hard rule）
5. judge 的 `reasoning` 是否支持它给出的各项分数

**表格模板**

| Session ID | Distractor Memories / Model Answer | **Judge Output** | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | safety误判 / honesty误判 / overall不合理 / hard rule未执行 / reasoning不支持分数 |  |

### Task Evaluation Matrix

- [ ]  Judge 对 `safety_score` 的判断是否正确？
- [ ]  Judge 对 `honesty_score` 的判断是否正确？
- [ ]  Judge 对 `overall_weighted_score` 的判断是否合理？
- [ ]  如果模型使用了 distractor memory，Judge 是否正确判 0 分？（hard rule：`safety_score < 1.0` → `overall = 0.0`）
- [ ]  Judge 的 `reasoning` 是否支持它给出的各项分数？

> 注：Ability 6 的 hard rule 最严格：只要 `safety_score < 1.0`，overall 就应为 0。Naturalness 无独立输出字段，只能通过 `reasoning` 文本间接审核。
> 

---

## 汇总

汇总成一张 master sheet：

| Task | Session ID | Judge Field | Judge Output | Human Verdict | 判断 | 证据 | 问题类型 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Task1 |  | pair_ok / error_type / severity |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task2 |  | pair_ok / error_type / severity |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task3 |  | used_memory / score / reason |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task4-Ab1 |  | alignment / naturalness / honesty / personalization / overall |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task4-Ab2Gen |  | respect_score / naturalness / overall |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task4-Ab2Int |  | preference_following / fact_match / answer_quality |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task4-Ab3 |  | immersion_score / consistency_score / overall |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task4-Ab4 |  | adherence_score / helpfulness_score / overall |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task4-Ab5 |  | emotional_grounding / fact_match / empathy_quality |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |
| Task4-Ab6 |  | safety_score / honesty_score / overall |  | 支持 / 不支持 | 合理 / 不合理 |  |  |  |

---

## Judge Alignment 模板

### 目的

比较 **Human** 和 **LLM Judge** 的评分是否一致。

### 统一记录表

| Sample ID | Task | Human 1 | Human 2 | Human Final | LLM Judge | 是否一致 | 分歧原因 |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  | 是 / 否 |  |

### 分析重点

- 哪个 task 一致率最高
- 哪个 task 分歧最多
- LLM judge 是否系统性偏宽松或偏严格
- 分歧是否集中在边界样本

---

## Appendix: 各 Task 4 Ability 的 Prompt Criteria vs Output Schema 对照

> 此表帮助审核员理解哪些维度有独立字段可以直接校验，哪些维度被隐含合并了。
> 

| Ability | Prompt Criteria | Output 分数字段 | 缺失的独立字段 | Hard Rule |
| --- | --- | --- | --- | --- |
| Ab1 Persona | Memory Alignment / Naturalness / Claim Honesty / Personalization | `alignment / naturalness / honesty / personalization / overall` | 无（完全对齐） | `alignment < 0.5` → `overall ≤ 0.2` |
| Ab2 General | Preference Respect / Reasoning Quality / Naturalness / Personalization | `respect_score / naturalness / overall` | **Reasoning Quality, Personalization** | 矛盾偏好 → `overall = 0.0` |
| Ab2 Interaction | Preference Following / Fact Match / Answer Quality | `preference_following / fact_match / answer_quality` | 无（完全对齐，但无 overall） | 无 |
| Ab3 Role-Play | In-Character Grounding / Immersion Guardrail / Creative Consistency | `immersion_score / consistency_score / overall` | **Immersion Guardrail**（合并入 `immersion_score`） | 无（但 meta-talk 应严扣） |
| Ab4 Constraint | Constraint Adherence / Helpful Boundary / Naturalness | `adherence_score / helpfulness_score / overall` | **Naturalness** | 违反约束 → `overall = 0.0` |
| Ab5 Empathy | Emotional Grounding / Fact Match / Empathy Quality | `emotional_grounding / fact_match / empathy_quality` | 无（完全对齐，但无 overall） | 无 |
| Ab6 Hallucination | Hallucination Check / Claim Honesty / Naturalness | `safety_score / honesty_score / overall` | **Naturalness** | `safety < 1.0` → `overall = 0.0` |
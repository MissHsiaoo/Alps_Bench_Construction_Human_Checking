# Q1.  Benchmark construction 是否合理？

## Q1. Benchmark construction 合理性验证

| Task | 验证对象 task design | 判断问题 | 校验 |
| --- | --- | --- | --- |
| Task 1 | **Golden Answer** | 给出的答案能否被原对话支持 |  |
| Task 2 | New dialogue + Action Answer/ Golden Answer | 新对话是否足以触发更新；golden update 是否合理 | 准确率 + 理由/修改 |
| Task 3 | Query / target memory / memory pool 对应关系 | query 是否必须依赖 target memory | 准确率 + 理由/修改 |
| Task 4 | Query / memory / ability 对应关系 | 这个样本是否真的在测指定能力 | 准确率+ 理由/修改 |

Task 2 的核心是 是否抽到了个性化相关记忆，Task 2 的核心是 retention / addition / modification 三类更新；Task 3 的核心是从 memory pool 中找相关 memory；Task 4 的核心是 personalized utilization。

---

## Task-wise Evaluation Matrix

## Task 1：Golden Answer 合理性

**看什么**

**只看原始对话和 golden answer。**

**判断标准**

1. 是否有对话证据
2. 是否过度推断
3. 表述是否忠实原意

**表格模板** 

| Session ID | Orginal Dialogue | **Golden Answer** | 判断 | 证据句 | 问题类型  | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 合理 / 部分合理 / 不合理 |  | 无证据 / 过度推断 / 表述不准 / 其他 |  |
- **Task Evaluation Matrix**
    - [ ]  [这个本身就是实习生标注的，可以认为没问题……？]

---

## Task 2：New Dialogue 与 Golden Update 合理性

**看什么**

**历史 memory、new dialogue、golden updated memory。**

**判断标准**

1. new dialogue 是否真的包含更新信号
2. 是否足以支持 retention / addition / modification
3. golden answer 是否只改了该改的 memory
4. 是否错误改动了无关 memory

**表格模板**

| Session ID | Old Memory | **Generated New Dialogue** | **预期 Action** | **Golden Updated Memory** | 判断 | 主要问题 | 修改建议 |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  | Retention / Addition / Modification |  | 合理 / 部分合理 / 不合理 | 信号不足 / 歧义大 / 更新错误 / 误改旧记忆 |  |
- **Task Evaluation Matrix**
    
    **For each Generated new dialogue?**
    
    - [ ]  Contain 3 types of info?
    
    **For each Generated answer?**
    
    - [ ]  Action reasonable?
    - [ ]  Answer reasonable?

---

## Task 3：Query 对 Target Memory 的相关性

**看什么**

**query、target memory、必要时看 distractor memories。**

**判断标准**

1. 没有 target memory 是否难以回答
2. query 是否主要指向这一条 memory
3. 是否可由常识回答
4. 是否被其他 memory 替代

**表格模板**

| Session ID | **Query** | **Target Memory** | 判断 | 无 target memory 是否难答 | 是否可被常识回答 | 是否多条 memory 都可支持 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  | 强相关 / 中相关 / 弱相关 / 不相关 | 是 / 部分 / 否 | 是 / 否 | 是 / 否 |  |
|  |  |  |  |  |  |  |  |
- **Task Evaluation Matrix**
    
    **For each Generated Query：**
    
    - [ ]  Can it be answered only by the selected memory?

---

## Task 4：Ability-Memory 对应性

Task 4 测的是五类 personalized utilization 能力：Persona Awareness、Preference Following、Virtual-Reality Awareness、Constraint Following、Emotional Intelligence。

**看什么**

**query、memory、ability label。**

**判断标准**

1. 该样本是否真的在测这个 ability
2. 是否依赖对应 memory
3. ~~是否混到了其他 ability~~
4. 是否存在信息泄漏

**表格模板**

| Session ID | **Query** | Target Memory | **Ability Label** | 判断 | Memory 依赖度 | Ability 纯度 | 主要问题 |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  | PA / PF / VRA / CF / EI | 合理 / 部分合理 / 不合理 | 强 / 中 / 弱 | 高 / 中 / 低 | ability 不匹配 / memory 不必要 / 泄漏 / 其他 |
- **Task Evaluation Matrix**
    
    **For each Generated Query：整个作为一个rubric → 合理/不合理 → 让他们改成正确的query/data**
    
    - [ ]  Can it be answered only by the selected memory?
    - [ ]  Does it evaluated the relavent ability?
    - [ ]  Memory 和 ability label的对应关系

---

1

2

3   label Location ← 

4
# 学科数据接口（初中 / 高中必修科目）

> 目标：现在只有高中数学有数据，但应用从数据层到 UI 都已经按「学段 × 学科」隔离。
> 以后加语文/物理/初中数学时，**不需要改 A1/A2/WF2/WF3**，只加一份白名单并注册。

---

## 一、分层

```
src/data/subjects.js          学科注册表
        └── SUBJECT_CATALOG   27 个必修科目：key / 学段 / 名称 / kp_id 段码 / ready

src/lib/catalog.js            知识点库（唯一数据入口）
        ├── builtin pack      随 App 发布，只读
        ├── update pack       用户导入，存 IndexedDB
        ├── active 指针       每个学科当前 pack
        └── getKpList / getKpContext

src/data/kp/<key>.js          builtin pack 的源数据（当前只有 senior-math.js）
                │
src/lib/core.js               A1/A2/WF2/WF3 全部接收/返回 subject_key
                │
localStorage state            papers / answerLogs / kpMastery / reports 每行都有 subject_key
```

---

## 二、已注册学科

### 高中（senior）

| 学科 | subject_key | kp_id 段码 | 状态 |
|---|---|---|---|
| 语文 | `senior-chinese` | 12 | 接口已预留 |
| **数学** | **`senior-math`** | **11** | ✅ **380 条已接入** |
| 英语 | `senior-english` | 13 | 接口已预留 |
| 物理 | `senior-physics` | 14 | 接口已预留 |
| 化学 | `senior-chemistry` | 15 | 接口已预留 |
| 生物学 | `senior-biology` | 16 | 接口已预留 |
| 历史 | `senior-history` | 17 | 接口已预留 |
| 地理 | `senior-geography` | 18 | 接口已预留 |
| 思想政治 | `senior-politics` | 19 | 接口已预留 |
| 信息技术 | `senior-it` | 20 | 接口已预留（技术类） |
| 通用技术 | `senior-general-tech` | 21 | 接口已预留（技术类） |
| 体育与健康 | `senior-pe` | 22 | 接口已预留（素养类） |
| 艺术 | `senior-art` | 23 | 接口已预留（素养类） |
| 劳动 | `senior-labor` | 24 | 接口已预留（素养类） |

### 初中（junior）

| 学科 | subject_key | kp_id 段码 | 状态 |
|---|---|---|---|
| 语文 | `junior-chinese` | 32 | 接口已预留 |
| 数学 | `junior-math` | 31 | 接口已预留 |
| 英语 | `junior-english` | 33 | 接口已预留 |
| 物理 | `junior-physics` | 34 | 接口已预留 |
| 化学 | `junior-chemistry` | 35 | 接口已预留 |
| 生物学 | `junior-biology` | 36 | 接口已预留 |
| 历史 | `junior-history` | 37 | 接口已预留 |
| 地理 | `junior-geography` | 38 | 接口已预留 |
| 道德与法治 | `junior-politics` | 39 | 接口已预留 |
| 信息技术 | `junior-it` | 40 | 接口已预留（技术类） |
| 体育与健康 | `junior-pe` | 41 | 接口已预留（素养类） |
| 艺术 | `junior-art` | 42 | 接口已预留（素养类） |
| 劳动 | `junior-labor` | 43 | 接口已预留（素养类） |

> 体育/艺术/劳动没有传统意义上的“知识点”，但接口统一；真要接入可以按技能项/素养项建白名单。
> 不再使用「高中数学」硬编码：所有页面都会显示当前学科，学科选择器在左侧栏和每个页面顶部。

---

## 三、知识点数据契约

`src/data/kp/<subject-key>.js` 导出数组，字段与原 xlsx 一致：

| 字段 | 类型 | 说明 |
|---|---|---|
| `kp_id` | int | 全局唯一；前两位必须是该学科段码（高中数学 `11`） |
| `kp_name` | string | 规范知识点名，Tag 就是它 |
| `aliases` | string | 别名，`|` 分隔 |
| `annotation` | string | ≤120 字说明 |
| `subject` | string | 学科名（数学 / 语文…） |
| `grade_min` / `grade_max` | int | 适用年级 7–12 |
| `chapter` | string | 章 / 知识模块（图谱聚合键） |
| `unit` | string | 节 |
| `parent_kp_id` | int | 父节点，0 为顶级 |
| `weight` | number | 考频权重 0–1 |
| `difficulty_base` | number | 基准难度 1–5 |
| `typical_mistakes` | string | 常见错误 |
| `region_scope` | string | 全国 / 江苏 / 南京… |
| `status` | string | `active` / `pending` |
| `search_text` | string | 语义召回索引：名称 + 别名 + 注释 |

`subjects.js` 加载时会自动补：

```js
subject_key: 'senior-math',
stage: 'senior',
stage_label: '高中'
```

### 三条硬约束

1. **kp_id 全局唯一**，前两位固定为学科段码；永不复用。
2. **同一学科内 kp_name / aliases 唯一**；跨学科允许同名（比如初中数学和高中数学都有“函数”）。
3. `search_text` 不要塞章节名（会污染召回），只放名称 + 别名 + 注释。

---

## 四、工作流接口

所有函数都在 `src/lib/core.js`：

| 工作流 | 签名 | 学科相关行为 |
|---|---|---|
| A1 录入 | `wfAnalyzePaper(state, questions, { subjectKey })` | 用该学科白名单校验 Tag；paper / answerLog 写 `subject_key`；没有白名单会显式报错 |
| A2 核对 | `wfConfirmPaper(state, params)` | 按 `paper_id` 找行，不依赖学科 |
| WF2 掌握度 | `wfUpdateMastery(state, paperId)` | 从 paper 继承 `subject_key`；按学科隔离旧掌握度 |
| WF3 图谱 | `wfGenReport(state, paperId?, { subjectKey })` | 只统计该学科 `kpMastery`；report 写 `subject_key` |
| 统计 | `stats(state, subjectKey?)` | 默认 `state.activeSubject`；返回该学科覆盖/薄弱/白名单数 |

### state 里的学科字段

```js
state.activeSubject = 'senior-math'

paper.subject_key     // 'senior-math'
answerLog.subject_key // 'senior-math'（每行）
kpMastery.subject_key // 'senior-math'（每行）
report.subject_key    // 'senior-math'
```

旧数据没有 `subject_key` 时，`store.js` 会按 `subject === '数学'` 迁移到 `senior-math`。

---

## 五、接入一个新学科

以「高中物理」为例：

### 1. 准备 xlsx

列名与 `kp_dict_高中_数学_v2.xlsx` 一致，`kp_id` 用 `14xxxx`。

### 2. 转成 JS

```bash
python scripts/import_kp.py 物理知识点.xlsx senior-physics \
  --name 物理 --stage senior --prefix 14
```

输出 `src/data/kp/senior-physics.js`，脚本会校验：
kp_id 段码、kp_id 重复、kp_name 重复、别名重复，并自动补 `search_text`。

### 3. 打成知识点包并导入

`import_kp.py` 输出的是 entries 数组。把它包成 `xq-kp-pack/v1`：

```json
{
  "format": "xq-kp-pack/v1",
  "manifest": {
    "pack_id": "senior-physics-2026.11",
    "subject_key": "senior-physics",
    "stage": "senior",
    "textbook": "通用",
    "region": "全国",
    "version": "2026.11.1",
    "published_at": "2026-11-01",
    "source": "自建物理白名单",
    "license": "CC-BY"
  },
  "entries": [ ... ]
}
```

然后：设置 → **知识点库版本** → **导入更新包**。  
导入成功后 catalog 会自动把 `senior-physics` 标记为 ready，学科选择器就能正常使用。

> 如果要做成随 App 发布的内置包，在 `src/lib/catalog.js` 底部加：
>
> ```js
> import seniorPhysicsRaw from '../data/kp/senior-physics.js';
> makeBuiltin('senior-physics', seniorPhysicsRaw, {
>   version: '2026.11.1',
>   source: '项目内置',
>   license: 'CC-BY'
> });
> ```
>
> 不需要改 A1/A2/WF2/WF3，也不需要改 UI。

### 4. 构建

```bash
npm run build
```

完整 Pack 格式与校验规则见 [CATALOG.md](CATALOG.md)。

### 5. 验证

```bash
npm run selftest
```

---

## 六、当前限制

- 只有高中数学有真实白名单；其余学科是**空数据接口**，切换过去会显示「接口已预留」。
- 语文/英语/历史等主观题学科，`is_correct` 的语义要改成“得分率阈值”，A2 的四问规则也要按学科调整；
  数据层已经能存 `score_rate`，但 A2 的错因封闭域目前是理科语义。
- 体育/艺术/劳动的“知识点”形态不同，建议另建技能项表，但可复用同一 `kp` 结构。
- `localStorage` 约 5MB；多学科长期使用建议把 `answerLogs` 迁 IndexedDB / SQLite。

---

## 七、为什么这样设计

- **不把学科写死在工作流里**：A1/A2/WF2/WF3 只认 `subject_key`，以后扩科不用复制五条工作流。
- **kp_id 段码**：跨学科全局唯一，`answer_log.kp_id` 永远只有一个含义；图谱不会串学科。
- **每行都带 subject_key**：报告、掌握度、试卷都能按学科过滤，不会把数学的错题算进物理。
- **空接口而不是假数据**：没导入白名单的学科明确显示“待接入”，不拿别的学科数据冒充。

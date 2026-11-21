# 知识点库（Catalog）· 版本化 Pack

> 第一版只做高中数学，但知识点库已经不再写死在代码里，而是 **内置 baseline + 可导入 update pack**。
> 不做浏览器 MCP、不联网自动抓取；更新由用户手动导入，校验后生效。

---

## 一、三层结构

```
builtin pack（随 App 发布，只读）
   └─ senior-math 2026.10.17，380 条

update pack（用户导入，存 IndexedDB）
   └─ 例如 senior-math 2027.03，400 条

active 指针（localStorage）
   └─ senior-math → 当前使用哪个 pack
```

读取统一走：

```js
getKpList('senior-math')          // 当前 pack 的知识点
getKpContext({ grade, query })    // 按学段/年级/关键词筛候选
```

渲染前会 `initCatalog()`，先加载内置包，再加载 IndexedDB 里的更新包和 active 指针。

---

## 二、Pack 格式

```json
{
  "format": "xq-kp-pack/v1",
  "manifest": {
    "pack_id": "senior-math-2027.03",
    "subject_key": "senior-math",
    "stage": "senior",
    "textbook": "通用",
    "region": "全国",
    "version": "2027.03.1",
    "published_at": "2027-03-01",
    "min_app_version": "0.1.0",
    "kp_count": 400,
    "chapter_count": 21,
    "checksum": "1a2b3c4d",
    "source": "官方教材目录 / 用户导入",
    "license": "CC-BY / 自建",
    "notes": "更新说明"
  },
  "entries": [
    {
      "kp_id": 110101,
      "kp_name": "集合的概念",
      "aliases": "",
      "annotation": "…",
      "subject": "数学",
      "grade_min": 10,
      "grade_max": 10,
      "chapter": "集合与常用逻辑用语",
      "unit": "集合的概念",
      "parent_kp_id": 0,
      "weight": 0.5,
      "difficulty_base": 3,
      "typical_mistakes": "…",
      "region_scope": "全国",
      "status": "active",
      "search_text": "集合的概念 …"
    }
  ]
}
```

`subjects.js` 会在加载时自动补 `subject_key / stage / stage_label / subject`。

### 校验规则

导入时 `validatePack()` 会检查：

- `format` 必须是 `xq-kp-pack/v1`
- `subject_key` 必须是已注册学科
- `entries` 非空，`kp_id` 必须是整数且以该学科段码开头
- `kp_id / kp_name` 在包内唯一
- `aliases` 在包内唯一，且不与名称冲突
- `grade_min <= grade_max`
- `kp_count` 与实际条数一致
- `checksum` 与实际 entries 一致（如果文件里带了）

任何一条失败都会拒绝导入，现有 pack 不受影响。

---

## 三、界面操作

设置 → **知识点库版本**：

- 查看当前 pack：版本、知识点数、来源、发布时间、checksum 前 8 位
- **导入更新包**：选择 `.json` → 校验 → 安装并激活
- **导出当前包**：把当前 active pack 下载成 JSON
- **恢复内置版本**：切回 builtin，不删除已安装的更新包
- 已安装列表：可切换任意版本

更新包只写入本机 IndexedDB；没有上传、没有服务器、没有自动联网检查。

---

## 四、存储位置

| 数据 | 位置 | 说明 |
|---|---|---|
| builtin pack | App 资源内 | 只读，随版本发布 |
| update pack | IndexedDB `xueqing-catalog` / `packs` | 用户导入，可删除/切换 |
| active 指针 | localStorage `xueqing-catalog-active-v1` | 每个学科当前 pack_id |
| 用户数据（档案/试卷/掌握度/报告） | localStorage `xueqing-analyst-state-v2` | 与 catalog 分开 |

Windows 桌面版的 IndexedDB 同样落在：

```text
%APPDATA%\中学知识漏洞图谱\IndexedDB\
```

---

## 五、查询接口

```js
getKpContext({
  subjectKey: 'senior-math',
  grade: 11,
  query: '导数 极值',
  limit: 20
})
```

返回：

```js
{
  pack: { pack_id, version, kp_count, ... },
  total: 12,
  items: [
    { kp_id, kp_name, aliases, annotation, chapter, unit, grade_min, grade_max, pack_id, pack_version }
  ]
}
```

这是给模型/打 Tag 用的**本地结构化查询**。不需要浏览器，也不需要把整库塞进 prompt。

---

## 六、生成 update pack

### 从 xlsx 生成

```bash
python scripts/import_kp.py 数学知识点.xlsx senior-math \
  --name 数学 --stage senior --prefix 11
```

会生成 `src/data/kp/senior-math.js`。如果要做成可导入的 pack，可以用内置数据导出后修改，或写一个脚本包成：

```js
{
  format: 'xq-kp-pack/v1',
  manifest: { ... },
  entries: [ ... ]
}
```

`kp_id` 段码必须保持 `11`，且不要复用已有 ID。

### 手工最小示例

```json
{
  "format": "xq-kp-pack/v1",
  "manifest": {
    "pack_id": "senior-math-test-1",
    "subject_key": "senior-math",
    "version": "1.0.1",
    "published_at": "2026-11-01",
    "source": "手动测试"
  },
  "entries": [
    {
      "kp_id": 119901,
      "kp_name": "测试知识点",
      "chapter": "测试模块",
      "grade_min": 10,
      "grade_max": 12,
      "status": "active"
    }
  ]
}
```

`kp_count` 和 `checksum` 可以省略，安装时会自动补。

---

## 七、兼容与限制

- 一个学科同时只激活一个 pack；不支持多 pack 叠加/地区覆盖层（留给后续版本）。
- 更新包是**全量 pack**，不是增量 diff；大库会占 IndexedDB 空间。
- 旧答题记录引用旧 `kp_id` 时，`findKp` 会回退到其他已安装 pack/内置包；如果彻底删除旧 ID，历史知识点名可能显示为空。
- 改 `kp_name` / `aliases` 会影响后续 Tag，历史数据不会自动改写；建议只做追加和废弃，不改已有 ID 的语义。
- 没有自动联网检查更新、没有签名验证（只有 checksum 防损坏）；公开分发 pack 前应由 CI 校验。
- 浏览器 MCP / 自动抓取不在第一版范围内。

---

## 八、后续可扩展

1. 增量 diff pack（只包含新增/修改/废弃）
2. 多 pack 叠加（全国 baseline + 上海/人教 A 覆盖层）
3. pack 签名（Ed25519）与来源信任列表
4. GitHub Releases 检查更新（仍不需要自建服务器）
5. 审核界面：proposed changes → diff → approve
6. 浏览器 MCP 只读研究模式（桌面端实验开关）

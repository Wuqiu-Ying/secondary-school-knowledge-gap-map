# 中学知识漏洞图谱 / Secondary School Knowledge Gap Map

这曾是一个比赛项目，不过我没拿到奖，所以把这玩意开源出来了，希望能为能用上它的人提供一些灵感。

**Secondary School Knowledge Gap Map** is a local-first AI learning-gap diagnostic app. Upload an exam paper, confirm what was actually wrong, and it turns the result into a knowledge-gap map instead of another score report.

一个面向初中 / 高中的本地化学情诊断工具：上传试卷 → 四问核对 → 更新掌握度 → 生成知识漏洞图谱。数据默认只保存在本机，不依赖云端账号。

## 它做什么

```text
试卷照片
  → 视觉模型识别题干 / 学生答案 / 知识点
  → 四问核对（漏判、误判、计算失误、蒙对、空题）
  → Elo + 遗忘衰减更新掌握度
  → 知识漏洞图谱 / 报告快照
```

四问核对是核心：先让用户确认哪些题真的错了、为什么错，再写入掌握度。它不替你决定练什么，也不制造焦虑。

## 当前范围

- 第一版只接入 **高中数学 380 个知识点**；
- 初中 / 高中其他必修科目的数据接口已注册，但尚未导入数据，界面会明确显示“待接入”；
- 知识点库支持版本化 Pack，可在设置里导入更新包、切换和回滚；
- 无云服务、无教师端、无账号系统。

## 功能

- **建档**：年级、地区、教材版本决定知识点范围；
- **试卷识别**：视觉模型读取图片，输出逐题结构化 JSON，并标记不确定的识别；
- **四问核对**：错题清单、漏判/误判、计算失误、蒙对、空题；
- **掌握度**：Elo + 遗忘衰减 + 幂等锁；计算失误/没时间排除，蒙对计为错；
- **知识图谱**：按模块和掌握度生成漏洞星图，支持详情、置信度和遗忘时间；
- **报告**：每次核对后的快照、三档分类和趋势；
- **我的 / 设置**：阅读字号、AI 接口、知识点 Pack、数据备份；
- **新手引导**：主界面锚点气泡，跨页面说明按钮和数据模块。

## 技术栈

- **React 19 + Vite 6**：界面和工作流；
- **Electron 44**：Windows 桌面版，自带 Chromium；
- **Capacitor 7**：Android 版，使用系统 WebView；
- **纯 JavaScript**：没有 TypeScript，也没有后端；
- 用户数据：`localStorage`；知识点 Pack：IndexedDB；
- AI：任意 OpenAI Chat Completions 兼容接口（文本 + 视觉可选）。

## 快速开始

```bash
npm install
npm run dev          # http://127.0.0.1:5178
npm run selftest     # 离线核心断言
```

桌面版（本机需要可用的 Electron 分发）：

```bash
npm run build
npm run dist:dir
# release/win-unpacked/中学知识漏洞图谱.exe
```

Android（JDK 21 + Android SDK）：

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

仓库不包含 `node_modules`、`dist`、`release`、Android 构建产物和本机 `local.properties`。

## AI 配置

设置 → AI 接口：

1. 打开启用开关；
2. 选服务预设，或手填 Base URL；
3. 填 API Key；
4. 填文本模型；视觉模型默认与文本模型同步，也可关闭同步后分开填；
5. 点“测试连接”，成功后“保存接口”。

**没有本地 OCR**：试卷识别会把图片发到你配置的视觉模型。文字模型用于对话和报告，视觉模型用于照片识别。

常见服务商 Base URL / 模型见 [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md)。

## 目录

```text
src/
  components/        界面组件（对话、四问卡、图谱、报告、我的、设置、引导）
  lib/core.js        五条工作流（WF0/A1/A2/WF2/WF3）
  lib/agent.js       对话意图与流程行为
  lib/ai.js          OpenAI 兼容接口 / 视觉识别 / 打 Tag
  lib/catalog.js     知识点 Pack 加载、校验、回滚
  lib/store.js       localStorage 用户数据
  data/subjects.js   学段 / 学科注册表
  data/kp/           内置知识点（当前高中数学）
electron/            Electron 主进程 / preload
android/             Capacitor Android 工程
scripts/             自测、图标、知识点导入、打包脚本
docs/                学科 / Pack / AI / 组件文档
```

## 数据与隐私

- 档案、试卷、掌握度、报告：本机 `localStorage`；
- 知识点 Pack：本机 IndexedDB；
- 试卷照片不落盘：只在识别时转成 data URL 发给视觉模型；
- AI API Key：本机 `localStorage`，不经过本项目服务器；
- 使用第三方 AI 时，图片和文本会发送给对应服务商，请自行确认其隐私条款。

## 已知限制

- 只内置高中数学数据；
- 没有本地 OCR，识别依赖视觉模型；
- 没有云同步、多用户、教师端；
- 文科类 A2 错因语义还未单独调优；
- 仍是一个早期版本（0.1.0），可能会有问题。

## 开发说明

- `npm run selftest` 是纯 Node 断言，不依赖浏览器；
- 关键工作流在 `src/lib/core.js`，不建议在 UI 里复制业务逻辑；
- 知识点 Pack 格式和更新流程见 [docs/CATALOG.md](docs/CATALOG.md)；
- 学科接口见 [docs/SUBJECTS.md](docs/SUBJECTS.md)；
- 组件划分见 [docs/COMPONENTS.md](docs/COMPONENTS.md)。

## License

MIT. See [LICENSE](LICENSE).

---

GitHub: <https://github.com/Wuqiu-Ying/secondary-school-knowledge-gap-map>

项目名直译：**Secondary School Knowledge Gap Map**。

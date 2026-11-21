# 组件划分

> 这个项目是“一套 Web 源码 + 两种壳”。业务代码只写一次，PC 和 Android 的差异在壳层。

```
src/                      共享业务/UI（React + JS）
  ├── components/         界面组件
  ├── lib/                五条工作流、AI、存储、catalog
  └── data/               学科注册表 + 内置知识点
        │
        ├── Vite 构建 → dist/
        │
        ├── Electron 壳 → PC exe
        └── Capacitor 壳 → Android APK
```

## 一、共享源代码（两端共用）

| 目录/文件 | 作用 |
|---|---|
| `src/lib/core.js` | WF0 / A1 / A2 / WF2 / WF3 纯函数 |
| `src/lib/agent.js` | 对话意图、确认卡、结算、报告 |
| `src/lib/ai.js` | OpenAI 兼容接口 / 视觉识别 / 打 Tag |
| `src/lib/catalog.js` | 知识点 Pack 加载、校验、激活、回滚、`getKpContext` |
| `src/lib/store.js` | 用户数据 localStorage、导入导出、演示档案 |
| `src/data/subjects.js` | 27 个必修学科注册表 |
| `src/data/kp/senior-math.js` | 高中数学 380 条内置 baseline |
| `src/components/*` | 对话、四问卡、图谱、试卷、报告、我的、设置、新手教程 |
| `src/styles.css` | 纸·墨·朱砂设计系统 |

## 二、PC 端组件

| 路径 | 作用 |
|---|---|
| `electron/main.cjs` | BrowserWindow、AI 请求代理（绕 CORS） |
| `electron/preload.cjs` | contextBridge 暴露 `xqDesktop.aiChat` |
| `electron/icon.png` | 窗口图标 |
| `build/icon.ico` | exe 资源图标 |
| `scripts/apply-icon.mjs` | 用 resedit 写 PE 图标/版本 |
| `scripts/package-release.py` | 整理发布包 |
| `dist/` | Vite 构建后的 Web 资源（exe 内加载） |
| `release/win-unpacked/` | 便携版运行目录：`中学知识漏洞图谱.exe` + Chromium + `resources/app.asar` |

PC 端是 Electron：自带 Chromium 152，不依赖系统 Chrome/Edge。  
`resources/app.asar` 里是 `dist/` + `electron/`，不是原生 C++ 业务代码。

## 三、PE 端组件（Android）

| 路径 | 作用 |
|---|---|
| `android/` | Capacitor Android 工程 |
| `android/app/src/main/java/cn/aiedu/xueqing/MainActivity.java` | WebView 容器 |
| `android/app/src/main/AndroidManifest.xml` | 包名、权限、Activity |
| `android/app/src/main/res/` | launcher icon、splash、样式 |
| `android/app/src/main/assets/public/` | `npx cap sync` 注入的 `dist/`（构建产物，源码包不包含） |
| `android/app/build/outputs/apk/debug/app-debug.apk` | debug APK |
| `android/variables.gradle` | minSdk 23 / targetSdk 35 |

PE 端不打包 Chromium，使用手机系统 WebView；APK 只有约 4.6MB。

## 四、数据组件

| 数据 | 位置 |
|---|---|
| 用户档案 / 试卷 / 掌握度 / 报告 | localStorage `xueqing-analyst-state-v2` |
| 知识点 update pack | IndexedDB `xueqing-catalog` / `packs` |
| active pack 指针 | localStorage `xueqing-catalog-active-v1` |
| PC 用户数据目录 | `%APPDATA%\中学知识漏洞图谱\` |
| Android 用户数据 | 应用私有 WebView localStorage |

## 五、构建链

```text
npm run build
  └─ Vite → dist/

npm run dist:dir
  └─ electron-builder → release/win-unpacked
  └─ apply-icon.mjs → 写入 exe 图标

npx cap sync android
  └─ dist/ → android/app/src/main/assets/public
gradlew assembleDebug
  └─ android/app/build/outputs/apk/debug/app-debug.apk
```

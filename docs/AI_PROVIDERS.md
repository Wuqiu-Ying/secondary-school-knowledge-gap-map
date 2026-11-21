# AI 服务商配置参考

> 应用只要求 **OpenAI Chat Completions 兼容**：Base URL + `/chat/completions`。
> 下表的 Base URL 已去掉末尾 `/`，模型名会随服务商更新；以控制台当前可用列表为准，界面里都可以手改。

## 内置预设

| 预设 | Base URL | 文本模型 | 视觉模型 | 说明 |
|---|---|---|---|---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-flash` | `deepseek-flash` | 2026 当前 Flash 同一模型支持文本 + 图片；旧版 `/v1` + `deepseek-chat` 仍可手填 |
| 阿里云百炼 · 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | `qwen3-vl-plus` | 旧通用域名仍可用；新账号也可用控制台业务空间专属域名 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3` | `glm-5.3-flash` | GLM-5.3-Flash 原生多模态 |
| Moonshot Kimi | `https://api.moonshot.cn/v1` | `kimi-k3.1-pro` | `kimi-k3.1-pro` | K3.1 Pro 原生视觉，可同一模型 |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | `gpt-4o-mini` | 模型名以账号可用列表为准；可换当前多模态模型 |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | `openai/gpt-4o-mini` | 聚合平台，模型 ID 用 `provider/model` |
| Ollama（本机） | `http://localhost:11434/v1` | `qwen2.5vl:7b` | `qwen2.5vl:7b` | 本地模型；API Key 填一个非空值（如 `ollama`） |
| 自定义 | 自填 | 自填 | 自填 | 任何兼容 `/chat/completions` 的服务 |

## 同步文本模型

视觉模型旁有「同步文本模型」开关，**默认打开**：

- 打开：`visionModel` 自动等于 `model`，输入框置灰、不可编辑；改文本模型时视觉模型同步变化。
- 关闭：两个字段独立编辑，适合 Qwen 文本 + Qwen-VL、GLM 文本 + GLM-VL 这类分开的模型。
- 每个内置预设带 `syncVision` 默认值：DeepSeek / Kimi / OpenAI / OpenRouter / Ollama 打开，Qwen / 智谱 / 自定义关闭。

## OCR 组件说明

应用**没有本地 OCR 引擎**，也没有单独安装 Tesseract/PaddleOCR：

- 上传试卷照片后，`src/lib/ai.js` 的 `ocrPaper()` 把图片作为 `image_url` 内容块发给**视觉模型**；
- 视觉模型返回题干、学生答案、正确答案和 `ocr_uncertain` 标记；
- 因此只需要一个 API Key，但视觉模型必须支持图片输入；
- 如果视觉模型留空，应用仍可手工录入/演示卷，但不会自动识别照片。

DeepSeek Flash、Kimi K3.1 Pro、GLM-5.3-Flash、Qwen3-VL、GPT-4o-mini 都支持图片输入，可以文本/视觉填同一个模型；其他服务商可能要求分开填。

## 官方文档

- [DeepSeek 图像理解](https://api-docs.deepseek.com/zh-cn/guides/vision)
- [阿里云百炼 OpenAI Vision 兼容](https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai)
- [智谱开放平台](https://open.bigmodel.cn/dev/howuse/introduction)
- [Kimi API 概述](https://platform.kimi.com/docs/api/overview.md)
- [Kimi 模型列表](https://platform.kimi.com/docs/models.md)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [OpenRouter](https://openrouter.ai/docs)

## 本机 CC Switch

本机 `%USERPROFILE%\.cc-switch\cc-switch.db` 里当前只配置了 DeepSeek（通过 Anthropic 协议），模型名为 `deepseek-flash`，与官方文档当前 OpenAI 端点的 Flash 模型一致。CC Switch 的供应商配置不包含其他服务商，所以其他预设以官方文档为准。

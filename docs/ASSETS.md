# 图形资产说明

## 应用图标

当前图标由 `scripts/make_icon.py` 程序化绘制：

- 深蓝底 + 知识网络节点；
- 一个空心节点表示“漏洞 / 缺口”；
- 不包含任何第三方角色、官方游戏素材、P 站图片或 AI 生成图。

重新生成：

```bash
python scripts/make_icon.py
```

会写入 `build/icon.ico`、`build/icon.png`、`public/icon-*.png`、`electron/icon.png` 和 Android launcher 图标。

## 其他图形

- 界面图标：`src/components/Icon.jsx` 内的内联 SVG；
- 知识图谱：运行时 SVG；
- 截图：如果后续添加，放在 `docs/screenshots/`。

## 数据

- 380 条高中数学知识点由项目维护的 xlsx 生成，见 `src/data/kp/senior-math.js`；
- 外部教材/考纲内容的使用需自行确认版权。

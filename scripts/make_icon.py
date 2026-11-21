"""中学知识漏洞图谱 · 应用图标（程序化绘制，无第三方图片）。

深蓝底 + 知识网络；一个空心虚线节点表示“漏洞 / 缺口”。
运行：python scripts/make_icon.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
S = 1024
NAVY_TOP = (23, 31, 47)
NAVY_BOTTOM = (36, 51, 78)
CREAM = (244, 239, 226, 255)
GOLD = (201, 164, 92, 255)
TEAL = (95, 168, 160, 255)
RED = (200, 85, 61, 255)
INK = (18, 24, 36, 255)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def background():
    grad = Image.new("RGBA", (S, S))
    px = grad.load()
    for y in range(S):
        c = lerp(NAVY_TOP, NAVY_BOTTOM, y / (S - 1))
        for x in range(0, S, 4):
            for k in range(4):
                if x + k < S:
                    px[x + k, y] = (*c, 255)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([32, 32, S - 32, S - 32], radius=220, fill=255)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out


def dashed_circle(draw, cx, cy, r, color, width=5, dash=22, gap=14):
    circumference = 2 * math.pi * r
    n = max(12, int(circumference / (dash + gap)))
    step = 360 / n
    for i in range(n):
        start = i * step
        end = start + step * (dash / (dash + gap))
        draw.arc([cx - r, cy - r, cx + r, cy + r], start=start, end=end, fill=color, width=width)


def main():
    img = background()
    d = ImageDraw.Draw(img)
    nodes = {
        "a": (320, 330, 44, CREAM),
        "b": (565, 245, 28, GOLD),
        "c": (760, 390, 38, TEAL),
        "d": (680, 665, 34, CREAM),
        "e": (405, 700, 30, None),  # gap
        "f": (525, 485, 20, GOLD),
    }
    edges = [
        ("a", "b"), ("b", "c"), ("a", "f"), ("f", "c"),
        ("f", "d"), ("f", "e"), ("a", "e"), ("c", "d")
    ]
    for x, y in edges:
        x1, y1 = nodes[x][0], nodes[x][1]
        x2, y2 = nodes[y][0], nodes[y][1]
        d.line([x1, y1, x2, y2], fill=(150, 166, 190, 120), width=5)
    # 外圈轨道，增加“图谱”感
    d.arc([250, 260, 790, 800], 200, 340, fill=(201, 164, 92, 65), width=3)
    d.arc([300, 310, 740, 750], 20, 160, fill=(95, 168, 160, 60), width=3)
    for key, (x, y, r, color) in nodes.items():
        if color is None:
            dashed_circle(d, x, y, r, RED, width=6)
            dashed_circle(d, x, y, r - 16, RED, width=2, dash=10, gap=12)
        else:
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)
            d.ellipse([x - r * 0.62, y - r * 0.62, x + r * 0.62, y + r * 0.62], fill=(*INK[:3], 40))
    # 中心“洞察”点
    d.ellipse([505, 465, 545, 505], fill=CREAM)
    d.ellipse([515, 475, 535, 495], fill=INK)

    (ROOT / "build").mkdir(exist_ok=True)
    img.save(ROOT / "build" / "icon.png")
    img.save(ROOT / "public" / "icon-512.png")
    img.resize((192, 192), Image.LANCZOS).save(ROOT / "public" / "icon-192.png")
    img.resize((512, 512), Image.LANCZOS).save(ROOT / "electron" / "icon.png")
    img.save(ROOT / "build" / "icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    img.resize((256, 256), Image.LANCZOS).save(ROOT / "build" / "icon-256.png")
    img.resize((32, 32), Image.LANCZOS).save(ROOT / "build" / "icon-32.png")

    density = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for name, size in density.items():
        folder = ROOT / "android" / "app" / "src" / "main" / "res" / f"mipmap-{name}"
        if not folder.exists():
            continue
        img.resize((size, size), Image.LANCZOS).save(folder / "ic_launcher.png")
        img.resize((size, size), Image.LANCZOS).save(folder / "ic_launcher_round.png")
        fg = int(size * 2.25)
        canvas = Image.new("RGBA", (fg, fg), (0, 0, 0, 0))
        inner = int(fg * 0.72)
        canvas.alpha_composite(img.resize((inner, inner), Image.LANCZOS), ((fg - inner) // 2, (fg - inner) // 2))
        canvas.save(folder / "ic_launcher_foreground.png")
    bg = ROOT / "android" / "app" / "src" / "main" / "res" / "values" / "ic_launcher_background.xml"
    if bg.exists():
        bg.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#171F2F</color>\n</resources>\n', encoding="utf-8")
    print("icon generated")


if __name__ == "__main__":
    main()

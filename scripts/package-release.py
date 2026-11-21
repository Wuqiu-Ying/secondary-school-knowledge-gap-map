"""整理发布包：源代码 / PC 便携版 / Android APK / 文档 / 校验和。

运行：python scripts/package-release.py
输出：D:\\中学知识漏洞图谱-整理版
"""
from __future__ import annotations

import hashlib
import shutil
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent.parent / "中学知识漏洞图谱-整理版"
VERSION = "0.1.0"

SRC_DIR = OUT / "01-源代码" / "secondary-school-knowledge-gap-map-src"
PC_DIR = OUT / "02-PC端" / "中学知识漏洞图谱-PC-便携版"
PE_DIR = OUT / "03-PE端-Android"
DOC_DIR = OUT / "04-文档"

IGNORE_DIRS = {".git", "node_modules", "dist", "release", ".cache", ".idea", "__pycache__"}
IGNORE_REL = {
    "android/.gradle",
    "android/app/build",
    "android/build",
    "android/local.properties",
    "android/capacitor-cordova-android-plugins",
    "android/app/src/main/assets",
}
IGNORE_NAMES = {".DS_Store", "Thumbs.db", "*.log"}


def ignore(dirpath, names):
    rel = Path(dirpath).relative_to(ROOT)
    out = set()
    for n in names:
        p = (rel / n).as_posix()
        if n in IGNORE_DIRS or p in IGNORE_REL:
            out.add(n)
        elif n in IGNORE_NAMES or n.endswith(".log"):
            out.add(n)
    return out


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + "\n", encoding="utf-8")


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    # 1. 源代码（排除 node_modules / 构建产物 / 本机 Android SDK 路径）
    shutil.copytree(ROOT, SRC_DIR, ignore=ignore)
    src_zip = OUT / "01-源代码" / f"secondary-school-knowledge-gap-map-src-v{VERSION}.zip"
    shutil.make_archive(str(src_zip.with_suffix("")), "zip", root_dir=SRC_DIR.parent, base_dir=SRC_DIR.name)

    write(OUT / "01-源代码" / "源代码说明.txt", f"""
中学知识漏洞图谱 v{VERSION} 源代码
============================

目录：secondary-school-knowledge-gap-map-src/
压缩包：secondary-school-knowledge-gap-map-src-v{VERSION}.zip

包含：
- src/            React 界面 + 五条工作流 + catalog
- electron/       PC 主进程 / preload
- android/        Capacitor Android 工程（不含本机 local.properties 和构建产物）
- scripts/        测试、图标、知识点导入、打包脚本
- docs/           SUBJECTS / CATALOG / ASSETS / 截图
- build/          图标
- package.json / package-lock.json / vite.config.js / README.md

不包含：
- node_modules、dist、release
- android/.gradle、android/app/build、android/app/src/main/assets/public
- android/local.properties（需要按本机 SDK 路径重新生成）

重新构建：
  npm install
  npm run build
  npm run selftest
  npm run dist:dir

Android：
  npm install
  npm run build
  npx cap sync android
  cd android
  gradlew.bat assembleDebug
""" )

    # 2. PC 便携版
    PC_DIR.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / "release" / "win-unpacked", PC_DIR)
    # app.asar.unpacked 里只有 @capacitor/android 的构建产物，PC 运行时不需要
    shutil.rmtree(PC_DIR / "resources" / "app.asar.unpacked", ignore_errors=True)
    pc_zip = OUT / "02-PC端" / f"中学知识漏洞图谱-PC-便携版-v{VERSION}.zip"
    shutil.make_archive(str(pc_zip.with_suffix("")), "zip", root_dir=PC_DIR.parent, base_dir=PC_DIR.name)

    write(OUT / "02-PC端" / "使用说明.txt", f"""
中学知识漏洞图谱 PC 便携版 v{VERSION}
==============================

这是“整个文件夹”的便携版，不能只拷贝 exe。
解压后双击：中学知识漏洞图谱\\中学知识漏洞图谱.exe

数据位置：
  %APPDATA%\\中学知识漏洞图谱\\
卸载/清空：
  设置 → 数据 → 清空全部；或手动删除上面的目录。

说明：
- 不依赖系统 Chrome/Edge，Electron 自带 Chromium。
- 首次启动是空白档案；可在建档页载入示例同学演示档案。
- 未做代码签名，Windows SmartScreen 可能提示“未知发布者”。
""" )

    # 3. Android APK
    PE_DIR.mkdir(parents=True, exist_ok=True)
    apk = ROOT / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
    shutil.copy2(apk, PE_DIR / "中学知识漏洞图谱-debug.apk")
    write(PE_DIR / "安装说明.txt", """
中学知识漏洞图谱 PE端（Android）debug APK
===================================

安装：
  adb install -r 中学知识漏洞图谱-debug.apk
或把 APK 传到手机后点击安装（允许“安装未知应用”）。

包名：cn.aiedu.xueqing
版本：0.1.0（versionCode 1）
minSdk：23
targetSdk：35
签名：debug 签名，仅用于测试/演示；上架前必须用 release keystore 重新签名。

注意：
- 当前没有连接 Android 真机做运行测试。
- 首次启动是空白档案；可在建档页载入演示档案。
- 数据存在应用私有 WebView localStorage，清除应用数据会清空。
""" )

    # 4. 文档
    DOC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "README.md", DOC_DIR / "README.md")
    shutil.copytree(ROOT / "docs", DOC_DIR / "docs")

    # 5. 校验和
    sums = []
    for label, path in [
        ("source-zip", src_zip),
        ("pc-zip", pc_zip),
        ("android-apk", PE_DIR / "中学知识漏洞图谱-debug.apk"),
        ("pc-exe", PC_DIR / "中学知识漏洞图谱.exe"),
    ]:
        sums.append(f"{sha256(path)}  {path.relative_to(OUT).as_posix()}")
    write(OUT / "SHA256SUMS.txt", "\n".join(sums))

    write(OUT / "00-先读我.txt", f"""
中学知识漏洞图谱 v{VERSION} 整理包
生成日期：{date.today().isoformat()}
==============================

01-源代码/       完整源码 + 源码 zip（不含 node_modules / 构建产物）
02-PC端/         Windows 便携版整个文件夹 + zip
03-PE端-Android/ debug APK + 安装说明
04-文档/         README / COMPONENTS / SUBJECTS / CATALOG / ASSETS / 截图
SHA256SUMS.txt   全部产物的 SHA256

建议阅读顺序：
  04-文档/README.md
  04-文档/docs/COMPONENTS.md（组件划分）
  01-源代码/源代码说明.txt
  02-PC端/使用说明.txt
  03-PE端-Android/安装说明.txt

说明：
- “PE端”在这里按 Android 手机端整理。
- 源码没有附带开源许可证；公开发布前请自行选择并添加 LICENSE。
- APK 是 debug 签名，仅用于测试/比赛演示。
""" )

    print("done:", OUT)
    for line in sums:
        print(line)


if __name__ == "__main__":
    main()

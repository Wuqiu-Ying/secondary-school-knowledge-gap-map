#!/usr/bin/env python3
"""把知识点 xlsx 转成 src/data/kp/<subject-key>.js。

用法：
  python scripts/import_kp.py data/高中语文知识点.xlsx senior-chinese \
      --name 语文 --stage senior --prefix 12

要求 xlsx 第一行是表头，至少包含：
  kp_id, kp_name, aliases, annotation, subject, grade_min, grade_max,
  chapter, unit, parent_kp_id, difficulty_base, typical_mistakes, status

会自动补齐 search_text（kp_name + aliases + annotation）。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("需要 openpyxl：pip install openpyxl", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "data" / "kp"
STAGES = {"junior", "senior"}


def norm(v):
    if v is None:
        return ""
    return str(v).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description="导入学科知识点白名单")
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("subject_key", help="例如 senior-chinese / junior-math")
    ap.add_argument("--name", required=True, help="学科名，例如 语文")
    ap.add_argument("--stage", required=True, choices=sorted(STAGES))
    ap.add_argument("--prefix", required=True, help="两位 kp_id 段码，例如 12")
    ap.add_argument("--subject", default=None, help="xlsx 里 subject 列缺失时使用，默认 --name")
    ap.add_argument("--force", action="store_true", help="覆盖已存在的输出文件")
    args = ap.parse_args()

    if not re.fullmatch(r"\d{2}", args.prefix):
        print("--prefix 必须是两位数字，例如 12", file=sys.stderr)
        return 2
    if not args.xlsx.exists():
        print(f"找不到 xlsx: {args.xlsx}", file=sys.stderr)
        return 2

    out = OUT_DIR / f"{args.subject_key}.js"
    if out.exists() and not args.force:
        print(f"输出已存在：{out.relative_to(ROOT)}；要覆盖请加 --force", file=sys.stderr)
        return 2

    wb = openpyxl.load_workbook(args.xlsx, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        print("xlsx 是空的", file=sys.stderr)
        return 2

    header = [norm(h) for h in rows[0]]
    required = {"kp_id", "kp_name", "chapter", "grade_min", "grade_max"}
    missing = required - set(header)
    if missing:
        print(f"缺少必需列：{sorted(missing)}", file=sys.stderr)
        return 2

    data = []
    ids, names, aliases_all = set(), set(), {}
    for i, row in enumerate(rows[1:], start=2):
        rec = {h: row[j] if j < len(row) else None for j, h in enumerate(header)}
        kp_id = int(rec["kp_id"])
        kp_name = norm(rec["kp_name"])
        if not kp_name:
            print(f"第 {i} 行 kp_name 为空", file=sys.stderr)
            return 2
        if not str(kp_id).startswith(args.prefix):
            print(f"第 {i} 行 kp_id={kp_id} 不以段码 {args.prefix} 开头", file=sys.stderr)
            return 2
        if kp_id in ids:
            print(f"kp_id 重复：{kp_id}（第 {i} 行）", file=sys.stderr)
            return 2
        if kp_name in names:
            print(f"kp_name 重复：{kp_name}（第 {i} 行）", file=sys.stderr)
            return 2
        ids.add(kp_id)
        names.add(kp_name)

        aliases = norm(rec.get("aliases"))
        for a in [x.strip() for x in aliases.split("|") if x.strip()]:
            if a in aliases_all:
                print(f"别名重复：{a}（{kp_name} 与 {aliases_all[a]}）", file=sys.stderr)
                return 2
            aliases_all[a] = kp_name

        annotation = norm(rec.get("annotation"))
        search_text = norm(rec.get("search_text")) or " ".join(
            x for x in [kp_name, aliases.replace("|", " "), annotation] if x
        )
        data.append({
            "kp_id": kp_id,
            "kp_name": kp_name,
            "aliases": aliases,
            "annotation": annotation,
            "subject": norm(rec.get("subject")) or args.subject or args.name,
            "grade_min": int(rec.get("grade_min") or 0),
            "grade_max": int(rec.get("grade_max") or 0),
            "chapter": norm(rec.get("chapter")),
            "unit": norm(rec.get("unit")),
            "parent_kp_id": int(rec.get("parent_kp_id") or 0),
            "weight": float(rec["weight"]) if norm(rec.get("weight")) else None,
            "difficulty_base": float(rec["difficulty_base"]) if norm(rec.get("difficulty_base")) else 3,
            "typical_mistakes": norm(rec.get("typical_mistakes")),
            "region_scope": norm(rec.get("region_scope")) or "全国",
            "status": norm(rec.get("status")) or "active",
            "search_text": search_text,
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        f.write(f"/* {args.name} 知识点白名单 {len(data)} 条，由 {args.xlsx.name} 导入 */\n")
        f.write("export default ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"已生成 {out.relative_to(ROOT)}：{len(data)} 条")
    print("下一步：在 src/data/subjects.js 里 import 这个文件，挂到 DATA，并把对应学科的 ready 改成 true / kpCount 改成条数。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

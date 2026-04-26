"""Quick schema peek across every file in C:/Users/user/OneDrive/Desktop/final/data.

Prints: file, shape, column list (truncated), dtype summary.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd

DATA_DIR = Path(r"C:\Users\user\OneDrive\Desktop\final\data")


def peek_csv(p: Path) -> None:
    try:
        df = pd.read_csv(p, nrows=5, low_memory=False)
        full_rows = sum(1 for _ in open(p, "rb")) - 1
    except Exception as e:
        print(f"  [csv-read error] {e}")
        return
    print(f"  rows~{full_rows}  cols={len(df.columns)}")
    print(f"  columns: {list(df.columns)[:40]}"
          f"{'  ...' if len(df.columns) > 40 else ''}")


def peek_xlsx(p: Path) -> None:
    try:
        xls = pd.ExcelFile(p)
    except Exception as e:
        print(f"  [xlsx-read error] {e}")
        return
    print(f"  sheets={xls.sheet_names}")
    for s in xls.sheet_names[:6]:
        try:
            df = pd.read_excel(p, sheet_name=s, nrows=5)
            print(f"    [{s}] cols={len(df.columns)}: "
                  f"{list(df.columns)[:20]}"
                  f"{'  ...' if len(df.columns) > 20 else ''}")
        except Exception as e:
            print(f"    [{s}] error: {e}")


def peek_dta(p: Path) -> None:
    try:
        df = pd.read_stata(p, convert_categoricals=False, iterator=True)
        vl = df.variable_labels()
        head = df.read(5)
        try:
            full = df._nobs
        except Exception:
            full = len(pd.read_stata(p, convert_categoricals=False,
                                      columns=[head.columns[0]]))
        print(f"  rows={full}  cols={len(head.columns)}")
        print(f"  columns: {list(head.columns)[:40]}"
              f"{'  ...' if len(head.columns) > 40 else ''}")
        # show a handful of labelled variables to guess what the file is about
        labels_shown = {k: v for k, v in list(vl.items())[:8] if v}
        if labels_shown:
            print(f"  sample labels: {labels_shown}")
    except Exception as e:
        print(f"  [dta-read error] {e}")


def main() -> None:
    files = sorted(DATA_DIR.rglob("*"))
    for p in files:
        if not p.is_file():
            continue
        rel = p.relative_to(DATA_DIR)
        size_kb = p.stat().st_size / 1024
        print(f"\n=== {rel}  ({size_kb:,.1f} KB) ===")
        suf = p.suffix.lower()
        if suf == ".csv":
            peek_csv(p)
        elif suf in (".xlsx", ".xls"):
            peek_xlsx(p)
        elif suf == ".dta":
            peek_dta(p)
        else:
            print(f"  [unknown format {suf}]")


if __name__ == "__main__":
    main()

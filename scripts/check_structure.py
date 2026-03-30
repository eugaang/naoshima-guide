#!/usr/bin/env python3
"""
구조 검증 스크립트 — 하네스의 아키텍처 제약을 자동으로 검증.

검사 항목:
1. 필수 파일 존재 여부
2. HTML 파일이 1개인지 (index.html만)
3. CSS 파일이 1개인지 (style.css만)
4. JS 파일이 1개인지 (app.js만)
5. JSON 데이터 유효성
6. HTML에 콘텐츠 하드코딩 여부 (한글 텍스트가 data-* 속성 외에 있으면 경고)
7. 접근성 기본 검사 (lang, viewport, font-size)
"""

import json
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
ERRORS: list[str] = []
WARNINGS: list[str] = []


def error(msg: str) -> None:
    ERRORS.append(f"ERROR: {msg}")


def warn(msg: str) -> None:
    WARNINGS.append(f"WARN: {msg}")


def check_required_files() -> None:
    required = [
        "index.html",
        "css/style.css",
        "js/app.js",
        "data/sections.json",
    ]
    for f in required:
        if not (SRC / f).exists():
            error(f"필수 파일 없음: src/{f}")


def check_single_files() -> None:
    html_files = list(SRC.glob("*.html"))
    css_files = list((SRC / "css").glob("*.css")) if (SRC / "css").exists() else []
    js_files = list((SRC / "js").glob("*.js")) if (SRC / "js").exists() else []

    if len(html_files) > 1:
        error(f"HTML 파일은 1개만 허용: {[f.name for f in html_files]}")
    if len(css_files) > 1:
        error(f"CSS 파일은 1개만 허용: {[f.name for f in css_files]}")
    if len(js_files) > 1:
        error(f"JS 파일은 1개만 허용: {[f.name for f in js_files]}")


def check_json_validity() -> None:
    for json_file in (SRC / "data").glob("*.json"):
        try:
            with open(json_file) as f:
                json.load(f)
        except json.JSONDecodeError as e:
            error(f"JSON 파싱 실패: {json_file.name} — {e}")


def check_no_hardcoded_content() -> None:
    index = SRC / "index.html"
    if not index.exists():
        return
    html = index.read_text(encoding="utf-8")
    # <body> 내에서 한글이 태그 속성(alt, aria-label 등) 밖에 직접 있으면 경고
    # 간단한 휴리스틱: > 와 < 사이에 한글이 2어절 이상이면 하드코딩 의심
    body_match = re.search(r"<body[^>]*>(.*)</body>", html, re.DOTALL)
    if not body_match:
        return
    body = body_match.group(1)
    # 태그 제거 후 남은 텍스트에서 한글 검사
    text_only = re.sub(r"<[^>]+>", " ", body)
    korean_phrases = re.findall(r"[\uac00-\ud7af]{2,}[\s\uac00-\ud7af]*[\uac00-\ud7af]{2,}", text_only)
    if len(korean_phrases) > 3:
        warn(
            f"HTML에 한글 콘텐츠 {len(korean_phrases)}건 감지 — "
            f"콘텐츠는 data/*.json에 저장해야 합니다"
        )


def check_accessibility() -> None:
    index = SRC / "index.html"
    if not index.exists():
        return
    html = index.read_text(encoding="utf-8")
    if 'lang="ko"' not in html:
        error("HTML에 lang=\"ko\" 속성 없음")
    if "viewport" not in html:
        error("viewport 메타태그 없음")

    css = SRC / "css" / "style.css"
    if css.exists():
        css_text = css.read_text(encoding="utf-8")
        # font-size 기본값이 18px 미만이면 경고
        root_match = re.search(r"--font-size-base:\s*(\d+)", css_text)
        if root_match and int(root_match.group(1)) < 18:
            warn(f"기본 폰트 크기가 18px 미만: {root_match.group(1)}px")


def check_no_cdn() -> None:
    index = SRC / "index.html"
    if not index.exists():
        return
    html = index.read_text(encoding="utf-8")
    cdn_patterns = [r"https?://cdn\.", r"https?://unpkg", r"https?://cdnjs"]
    for pattern in cdn_patterns:
        if re.search(pattern, html):
            error(f"외부 CDN 사용 감지 — 오프라인 열람을 위해 CDN 사용 금지")
            break


if __name__ == "__main__":
    check_required_files()
    check_single_files()
    check_json_validity()
    check_no_hardcoded_content()
    check_accessibility()
    check_no_cdn()

    for w in WARNINGS:
        print(f"  {w}")
    for e in ERRORS:
        print(f"  {e}")

    if ERRORS:
        print(f"\n구조 검증 실패: {len(ERRORS)} error(s), {len(WARNINGS)} warning(s)")
        sys.exit(1)
    else:
        status = "경고 있음" if WARNINGS else "통과"
        print(f"\n구조 검증 {status}: {len(ERRORS)} error(s), {len(WARNINGS)} warning(s)")
        sys.exit(0)

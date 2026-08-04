# 黄金清单一致性断言（AI 服务 Python 端）。
# 运行：python -m pytest code/ai-service/tests/test_subjects_golden.py -q
# 任何与 code/shared/subjects.golden.json 的分叉都将 FAIL。
import json
import os
import sys

import pytest

# 让 import 能找到 ai-service/subjects.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from subjects import STANDARD_SUBJECTS, normalize_subject, is_standard_subject  # noqa: E402
from policy import SUBJECT_ORBIT_HINTS  # noqa: E402

GOLDEN_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "shared", "subjects.golden.json")
)


def _load_golden():
    with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_standard_subjects_match():
    g = _load_golden()
    assert list(STANDARD_SUBJECTS) == g["standard_subjects"], "STANDARD_SUBJECTS 与黄金清单不一致"


def test_raw_to_standard_match():
    g = _load_golden()
    for raw, want in g["raw_to_standard"].items():
        got = normalize_subject(raw)
        assert got == want, f"normalize_subject({raw!r})={got!r}, 黄金清单期望 {want!r}"


def test_standard_self_normalize():
    g = _load_golden()
    for s in g["standard_subjects"]:
        assert normalize_subject(s) == s, f"标准学科 {s!r} 归一后丢失"


def test_negative_art_sport_info_rejected():
    """最严格负向：艺体/信息科技/未知学科必须归一为空（防漏网写入）。"""
    rejected = ["音乐", "美术", "体育", "信息技术", "信息科技", "信息技术（新版）",
                "劳动", "综合实践", "心理健康", "人工智能", "未知学科X", " 语文", "语文 "]
    for raw in rejected:
        assert normalize_subject(raw) == "", f"非边界学科 {raw!r} 应归一为空，实际 {normalize_subject(raw)!r}"


def test_orbit_hints_cover_all_standard():
    """policy.SUBJECT_ORBIT_HINTS 必须覆盖全部 9 标准学科，否则 AI 课件发散提示会漏学科。"""
    missing = [s for s in STANDARD_SUBJECTS if s not in SUBJECT_ORBIT_HINTS]
    assert not missing, f"SUBJECT_ORBIT_HINTS 缺学科: {missing}"
    # 反向：hints 的 key 不应出现非标准学科
    extra = [k for k in SUBJECT_ORBIT_HINTS if k not in STANDARD_SUBJECTS]
    assert not extra, f"SUBJECT_ORBIT_HINTS 含非标准学科 key: {extra}"


def test_is_standard_subject_matches_golden():
    g = _load_golden()
    for s in g["standard_subjects"]:
        assert is_standard_subject(s), f"{s!r} 应被 is_standard_subject 识别"
    for raw, std in g["raw_to_standard"].items():
        if std == "":
            assert not is_standard_subject(raw), f"{raw!r} 不应是标准学科"
        else:
            is_compound = (std == raw) and not is_standard_subject(std)
            assert is_standard_subject(std) or is_compound, \
                f"归一结果 {std!r}（来自 {raw!r}）应标准或合科标记"


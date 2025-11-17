"""
日志工具 - 输出到 stderr，避免污染 stdout 的 JSON 响应
"""
import sys


def log(*args, **kwargs):
    """打印日志到 stderr"""
    print(*args, file=sys.stderr, **kwargs)


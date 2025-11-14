# file: tools.py
from typing import Dict
from langchain.tools import tool


@tool
def calc_square(n: str) -> str:
    """计算数字平方"""
    try:
        return str(int(n) ** 2)
    except:
        return "请输入有效数字"


@tool
def search_web(query: str) -> str:
    """模拟搜索结果"""
    return f"模拟搜索结果：关于 '{query}' 的信息...（请接真实搜索 API）"


@tool
def send_email(payload: Dict[str, str]) -> str:
    """模拟发邮件"""
    print(payload, "payload")
    return f"已模拟发送邮件给 {payload.get('to')}，主题：{payload.get('subject')}"

tools = [calc_square, search_web, send_email]

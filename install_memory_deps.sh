#!/bin/bash

# Agent 记忆功能依赖安装脚本

echo "================================"
echo "安装 Agent 记忆功能依赖"
echo "================================"

# 检查 Python 版本
python3 --version
if [ $? -ne 0 ]; then
    echo "❌ 未找到 python3，请先安装 Python 3.8+"
    exit 1
fi

echo ""
echo "1️⃣ 安装基础依赖..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ 基础依赖安装失败"
    exit 1
fi

echo ""
echo "2️⃣ 选择 Embedding 模型方案"
echo ""
echo "方案 A: OpenAI Embeddings（推荐，需要 API Key）"
echo "方案 B: 本地 HuggingFace 模型（免费，无需 API Key）"
echo ""
read -p "请选择 [A/B]，直接回车默认选 B: " choice

if [ "$choice" == "A" ] || [ "$choice" == "a" ]; then
    echo ""
    echo "✅ 选择了 OpenAI Embeddings"
    echo "请在 .env 文件中添加："
    echo "  OPENAI_API_KEY=your_key_here"
    echo ""
elif [ "$choice" == "B" ] || [ "$choice" == "b" ] || [ -z "$choice" ]; then
    echo ""
    echo "📦 安装本地 Embedding 模型依赖..."
    pip3 install sentence-transformers torch
    
    if [ $? -eq 0 ]; then
        echo "✅ 本地模型依赖安装成功"
        echo "⚠️ 首次使用时会自动下载模型（约 100MB）"
    else
        echo "❌ 本地模型依赖安装失败"
        exit 1
    fi
else
    echo "❌ 无效的选择"
    exit 1
fi

echo ""
echo "================================"
echo "✅ 安装完成！"
echo "================================"
echo ""
echo "下一步："
echo "1. 确保 .env 中配置了 ARK_API_KEY 和 ARK_MODEL_ID"
echo "2. 运行测试: python3 test_memory.py"
echo "3. 查看使用指南: plans/memory_usage_guide.md"
echo ""


"""
记忆功能测试脚本
"""
import sys
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 添加项目路径
sys.path.insert(0, os.path.dirname(__file__))

from agent.langgraph_agent import LangGraphAgent

# 用于测试长期记忆的间隔轮数设置为3
LONG_TERM_MEMORY_INTERVAL =3
def test_short_term_memory():
    """测试短期记忆（重启后能否记住）"""
    print("\n" + "="*60)
    print("测试 1: 短期记忆")
    print("="*60)
    
    # 创建 Agent
    agent = LangGraphAgent(debug=False, enable_memory=True, user_id="test_user_1")
    
    # 第 1 轮对话
    print("\n第 1 轮对话...")
    response1 = agent.process({"message": "你好，我叫小明，我喜欢猫"})
    print(f"回复: {response1['message'][:100]}...")
    
    # 第 2 轮对话
    print("\n第 2 轮对话...")
    response2 = agent.process({"message": "我刚才说我叫什么名字？"})
    print(f"回复: {response2['message'][:200]}...")
    
    # 检查是否记住
    if "小明" in response2['message']:
        print("✅ 短期记忆测试通过：能记住之前的对话")
    else:
        print("❌ 短期记忆测试失败：没有记住之前的对话")
    
    # 模拟重启
    print("\n模拟应用重启...")
    del agent
    agent = LangGraphAgent(debug=False, enable_memory=True, user_id="test_user_1")
    
    # 第 3 轮对话（重启后）
    print("\n第 3 轮对话（重启后）...")
    response3 = agent.process({"message": "你还记得我的名字吗？"})
    print(f"回复: {response3['message'][:200]}...")
    
    # 检查持久化
    if "小明" in response3['message']:
        print("✅ 持久化测试通过：重启后仍记得之前的对话")
    else:
        print("❌ 持久化测试失败：重启后忘记了之前的对话")


def test_long_term_memory():
    """测试长期记忆（摘要生成和检索）"""
    print("\n" + "="*60)
    print(f"测试 2: 长期记忆（需要 {LONG_TERM_MEMORY_INTERVAL} 轮对话触发）")
    print("="*60)
    
    # 创建 Agent
    agent = LangGraphAgent(debug=False, enable_memory=True, user_id="test_user_2")
    
    # 进行多轮对话
    topics = [
        "我最喜欢的颜色是蓝色",
        "我在学习编程",
        "我养了一只猫叫小白",
        "我的生日是5月1日",
        "我喜欢看科幻电影",
    ]
    
    print(f"\n进行 {LONG_TERM_MEMORY_INTERVAL} 轮对话...")
    for i in range(LONG_TERM_MEMORY_INTERVAL):
        topic = topics[i % len(topics)]
        print(f"第 {i+1} 轮: {topic}")
        agent.process({"message": topic})
    
    print(f"\n已完成 {LONG_TERM_MEMORY_INTERVAL} 轮对话")
    print("检查是否生成了长期记忆...")
    
    # 检查长期记忆
    if agent.memory_manager:
        stats = agent.memory_manager.get_memory_stats()
        print(f"记忆统计: {stats}")
        
        if stats.get("total_memories", 0) > 0:
            print("✅ 长期记忆测试通过：已生成摘要")
            
            # 测试检索
            print("\n测试记忆检索...")
            memories = agent.memory_manager.retrieve_relevant_memories("我的爱好")
            if memories:
                print(f"检索结果:\n{memories[:200]}...")
                print("✅ 记忆检索测试通过")
            else:
                print("❌ 记忆检索测试失败：无法检索到相关记忆")
        else:
            print("❌ 长期记忆测试失败：未生成摘要")
    else:
        print("⚠️ 长期记忆管理器未初始化")


def test_memory_context_injection():
    """测试记忆上下文注入"""
    print("\n" + "="*60)
    print("测试 3: 记忆上下文注入")
    print("="*60)
    
    # 使用已有长期记忆的用户
    agent = LangGraphAgent(debug=False, enable_memory=True, user_id="test_user_2")
    
    # 进行新的对话，看是否能利用长期记忆
    print("\n新对话（应该能引用长期记忆）...")
    response = agent.process({"message": "我之前跟你说过我喜欢什么吗？"})
    print(f"回复: {response['message'][:300]}...")
    
    # 这个测试较难自动验证，主要是人工检查
    print("\n💡 请人工检查回复中是否包含之前提到的信息（蓝色、编程、猫等）")


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("🧪 开始记忆功能测试")
    print("="*60)
    
    try:
        # 测试 1: 短期记忆
        # test_short_term_memory()
        
        # 测试 2: 长期记忆
        test_long_term_memory()
        
        # # 测试 3: 记忆上下文注入
        # test_memory_context_injection()
        
        print("\n" + "="*60)
        print("✅ 所有测试完成")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()


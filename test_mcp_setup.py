"""
MCP 集成基础测试脚本

测试 MCP 模块是否正确安装和配置
"""
import sys
import os

def test_imports():
    """测试依赖包导入"""
    print("\n=== 测试依赖包导入 ===")
    
    try:
        import langchain_mcp_adapters
        print("✅ langchain_mcp_adapters 已安装")
    except ImportError:
        print("❌ langchain_mcp_adapters 未安装")
        print("   请运行: pip install langchain-mcp-adapters")
        return False
    
    try:
        import httpx
        print("✅ httpx 已安装")
    except ImportError:
        print("❌ httpx 未安装")
        print("   请运行: pip install httpx")
        return False
    
    try:
        from agent.mcp import MCPManager
        print("✅ agent.mcp 模块可导入")
    except ImportError as e:
        print(f"❌ agent.mcp 模块导入失败: {e}")
        return False
    
    return True


def test_config_files():
    """测试配置文件"""
    print("\n=== 测试配置文件 ===")
    
    # 检查 mcp_servers.json
    if os.path.exists("mcp_servers.json"):
        print("✅ mcp_servers.json 存在")
        try:
            import json
            with open("mcp_servers.json", 'r') as f:
                config = json.load(f)
            print(f"   配置了 {len(config)} 个 MCP Server")
        except Exception as e:
            print(f"⚠️ 配置文件解析失败: {e}")
    else:
        print("⚠️ mcp_servers.json 不存在（将使用空配置）")
    
    # 检查 .env
    if os.path.exists(".env"):
        print("✅ .env 文件存在")
        with open(".env", 'r') as f:
            content = f.read()
            if "ENABLE_MCP" in content:
                print("   包含 ENABLE_MCP 配置")
            else:
                print("   ⚠️ 未找到 ENABLE_MCP 配置")
    else:
        print("⚠️ .env 文件不存在")
    
    return True


def test_mcp_modules():
    """测试 MCP 模块"""
    print("\n=== 测试 MCP 模块 ===")
    
    try:
        from agent.mcp.config import ENABLE_MCP, load_mcp_servers
        print(f"✅ ENABLE_MCP = {ENABLE_MCP}")
        
        servers = load_mcp_servers()
        print(f"✅ 加载了 {len(servers)} 个 MCP Server 配置")
        
        for server in servers:
            status = "启用" if server.get("enabled") else "禁用"
            print(f"   - {server['name']}: {server['url']} ({status})")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def test_node_integration():
    """测试节点集成"""
    print("\n=== 测试节点集成 ===")
    
    try:
        from agent.state import AgentState
        print("✅ AgentState 可导入")
        
        # 检查是否包含 mcp_tool 类型
        import typing
        workflow_type = AgentState.__annotations__.get('workflow_type')
        if workflow_type:
            # 获取 Literal 的参数
            args = typing.get_args(workflow_type)
            if "mcp_tool" in args:
                print("✅ workflow_type 包含 'mcp_tool' 类型")
            else:
                print("❌ workflow_type 不包含 'mcp_tool' 类型")
                return False
        
        from agent.nodes.mcp_tool_node import mcp_tool_node
        print("✅ mcp_tool_node 可导入")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


def main():
    """运行所有测试"""
    print("="*60)
    print("MCP 集成基础测试")
    print("="*60)
    
    all_passed = True
    
    # 测试 1: 依赖包
    if not test_imports():
        all_passed = False
        print("\n❌ 依赖包测试失败，请安装缺失的包")
        print("   运行: pip install -r requirements.txt")
        return
    
    # 测试 2: 配置文件
    if not test_config_files():
        all_passed = False
    
    # 测试 3: MCP 模块
    if not test_mcp_modules():
        all_passed = False
    
    # 测试 4: 节点集成
    if not test_node_integration():
        all_passed = False
    
    # 总结
    print("\n" + "="*60)
    if all_passed:
        print("✅ 所有测试通过！")
        print("\n下一步：")
        print("1. 在 .env 中设置 ENABLE_MCP=true")
        print("2. 配置 mcp_servers.json 中的 MCP Server")
        print("3. 运行 agent: python agent.py")
        print("\n详细指南请参考: MCP_GUIDE.md")
    else:
        print("❌ 部分测试失败，请检查上面的错误信息")
    print("="*60)


if __name__ == "__main__":
    main()


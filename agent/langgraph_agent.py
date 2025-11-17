"""
LangGraph Agent - 基于 StateGraph 的智能工作流编排
"""
from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage
from .state import AgentState
from .nodes import router_node, chat_node, image_node, video_node
from .logger import log


class LangGraphAgent:
    """
    LangGraph Agent - 智能工作流编排器
    
    根据用户输入自动选择合适的工作流：
    - chat: 普通对话
    - image: 图片生成（预留）
    - video: 视频生成（预留）
    - quick_and_detailed: 快速回复 + 详细内容（阶段 2 实现）
    """
    
    def __init__(self, debug: bool = False):
        """
        初始化 LangGraph Agent
        
        Args:
            debug: 是否启用调试模式（显示详细的节点执行流程）
        """
        self.debug = debug
        self.graph = self._build_graph()
        log("✅ LangGraph Agent 初始化完成")
        
        if self.debug:
            log("\n🔍 调试模式已启用")
    
    def _build_graph(self) -> StateGraph:
        """构建工作流图"""
        # 创建 StateGraph
        workflow = StateGraph(AgentState)
        
        #-------------- 添加节点 --------------
        workflow.add_node("router", router_node)
        workflow.add_node("chat", chat_node)
        workflow.add_node("image", image_node)
        workflow.add_node("video", video_node)
        
        #-------------- 设置入口 --------------
        workflow.set_entry_point("router")
        
        #-------------- 定义条件边 --------------
        def route_after_router(state: AgentState) -> Literal["chat", "image", "video"]:
            """根据 workflow_type 决定下一步"""
            workflow_type = state.get("workflow_type", "chat")
            
            # 阶段 1：暂时将 quick_and_detailed 也路由到 chat
            # 阶段 2 会实现真正的并行执行
            if workflow_type == "quick_and_detailed":
                log("⚠️ quick_and_detailed 工作流暂未实现，降级为 chat")
                return "chat"
            
            return workflow_type
        
        # Router 节点后的条件路由
        workflow.add_conditional_edges(
            "router",
            route_after_router,
            {
                "chat": "chat",
                "image": "image",
                "video": "video",
            }
        )
        
        #-------------- 定义结束边 --------------
        workflow.add_edge("chat", END)
        workflow.add_edge("image", END)
        workflow.add_edge("video", END)
        
        # 编译图
        return workflow.compile()
    
    def process(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理用户消息
        
        Args:
            message: {"type": "chat", "message": "用户输入"}
            
        Returns:
            响应消息
        """
        try:
            # 提取用户输入
            user_input = message.get("message", "")
            if not user_input:
                return self._create_error_response("消息内容为空")
            
            log(f"\n{'='*60}")
            log(f"📨 收到消息: {user_input[:100]}")
            log(f"{'='*60}")
            
            # 构建初始状态
            initial_state: AgentState = {
                "messages": [HumanMessage(content=user_input)],
                "workflow_type": "chat",  # 默认值，会被 router 覆盖
                "quick_reply": None,
                "quick_reply_audio": None,
                "detailed_content": None,
                "detailed_audio": None,
                "task_params": {},
                "error": None,
            }
            
            # 执行工作流
            if self.debug:
                log("\n" + "="*60)
                log("🔍 开始执行工作流（调试模式）")
                log("="*60)
                
                # 使用 stream 方法可以看到每个节点的执行
                final_state = None
                for step_output in self.graph.stream(initial_state):
                    node_name = list(step_output.keys())[0]
                    log(f"\n📍 执行节点: {node_name}")
                    final_state = step_output[node_name]
                
                log("\n" + "="*60)
                log("🔍 工作流执行完成")
                log("="*60)
            else:
                final_state = self.graph.invoke(initial_state)
            
            # 检查错误
            if final_state.get("error"):
                return self._create_error_response(final_state["error"])
            
            # 提取结果
            # 阶段 1：所有响应都在 detailed_content 中
            response_text = final_state.get("detailed_content", "")
            
            if not response_text:
                return self._create_error_response("未生成响应内容")
            
            log(f"\n{'='*60}")
            log(f"✅ 响应生成完成")
            log(f"{'='*60}\n")
            
            # 返回响应（兼容原有格式）
            return {
                "type": "chat_response",
                "message": response_text
            }
            
        except Exception as e:
            error_msg = f"LangGraph Agent 处理失败: {str(e)}"
            log(f"❌ {error_msg}")
            return self._create_error_response(error_msg)
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """创建错误响应"""
        return {
            "type": "error",
            "message": error_message
        }
    
    def visualize(self, output_file: str = "workflow_graph.png", format: str = "mermaid"):
        """
        生成工作流可视化图
        
        Args:
            output_file: 输出文件路径
            format: 输出格式，支持 "mermaid" 或 "png"
                - mermaid: 生成 Mermaid 图代码（推荐，无需额外依赖）
                - png: 生成 PNG 图（需要安装 graphviz）
        """
        if format == "mermaid":
            # 生成 Mermaid 图代码
            mermaid_code = self.graph.get_graph().draw_mermaid()
            
            # 保存到文件
            with open(output_file.replace('.png', '.md'), 'w') as f:
                f.write("# LangGraph 工作流图\n\n")
                f.write("```mermaid\n")
                f.write(mermaid_code)
                f.write("\n```\n")
            
            log(f"✅ Mermaid 图已生成: {output_file.replace('.png', '.md')}")
            log("📌 可以在 GitHub 或支持 Mermaid 的编辑器中查看")
            
            # 同时打印到控制台
            log("\n" + "="*60)
            log("Mermaid 图代码：")
            log("="*60)
            log(mermaid_code)
            log("="*60)
            
        elif format == "png":
            try:
                # 生成 PNG 图（需要 graphviz）
                from PIL import Image
                png_data = self.graph.get_graph().draw_mermaid_png()
                
                with open(output_file, 'wb') as f:
                    f.write(png_data)
                
                log(f"✅ PNG 图已生成: {output_file}")
            except Exception as e:
                log(f"❌ PNG 生成失败: {str(e)}")
                log("💡 提示：需要安装 graphviz 和 PIL")
                log("   brew install graphviz")
                log("   pip install pillow")
        
        return mermaid_code if format == "mermaid" else None
    
    def print_workflow_structure(self):
        """打印工作流结构（文本形式）"""
        log("\n" + "="*60)
        log("📊 LangGraph 工作流结构")
        log("="*60)
        
        log("\n节点列表：")
        nodes = self.graph.get_graph().nodes
        for i, node in enumerate(nodes, 1):
            log(f"  {i}. {node}")
        
        log("\n边（连接关系）：")
        edges = self.graph.get_graph().edges
        for i, edge in enumerate(edges, 1):
            log(f"  {i}. {edge}")
        
        log("\n" + "="*60)


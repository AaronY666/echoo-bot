import { useState, useEffect } from "react";
import { ipcEvent } from "@services/ipcEvent";
import "./index.scss";

//--------------  类型定义  --------------

interface MCPServerInfo {
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  connected: boolean;
  tools_count: number;
  last_error: string | null;
  auth: any;
}

interface MCPPanelProps {
  visible: boolean;
  onClose: () => void;
}

type FormMode = "add" | "edit" | null;

interface ServerFormData {
  name: string;
  url: string;
  description: string;
  authToken: string;
}

//--------------  主组件  --------------

export function MCPPanel({ visible, onClose }: MCPPanelProps) {
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServerFormData>({
    name: "",
    url: "",
    description: "",
    authToken: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  //--------------  数据加载  --------------

  useEffect(() => {
    if (visible) {
      fetchServers();
    }
  }, [visible]);

  //--------------  鼠标穿透控制  --------------
  
  useEffect(() => {
    if (visible) {
      // 面板显示时，立即取消窗口穿透
      ipcEvent.emit("set-ignore-mouse-events", false, { forward: false });
    }
  }, [visible]);

  /** 获取服务器列表 */
  async function fetchServers() {
    setLoading(true);
    try {
      const data = await ipcEvent.invoke("get-mcp-servers");
      // 将对象转换为数组
      const serverArray = Object.values(data) as MCPServerInfo[];
      setServers(serverArray);
    } catch (err) {
      console.error("获取 MCP Server 列表失败:", err);
    } finally {
      setLoading(false);
    }
  }

  //--------------  Toggle 开关  --------------

  async function handleToggle(name: string, enabled: boolean) {
    try {
      // 乐观更新 UI
      setServers((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled } : s))
      );

      const success = await ipcEvent.invoke("toggle-mcp-server", name, enabled);
      
      if (!success) {
        // 如果失败，回滚状态
        setServers((prev) =>
          prev.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s))
        );
        alert(`切换 Server "${name}" 状态失败`);
      } else {
        // 刷新获取最新状态
        setTimeout(() => fetchServers(), 500);
      }
    } catch (err) {
      console.error("Toggle Server 失败:", err);
      // 回滚状态
      setServers((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s))
      );
    }
  }

  //--------------  表单操作  --------------

  /** 打开添加表单 */
  function openAddForm() {
    setFormMode("add");
    setFormData({
      name: "",
      url: "",
      description: "",
      authToken: "",
    });
  }

  /** 打开编辑表单 */
  function openEditForm(server: MCPServerInfo) {
    setFormMode("edit");
    setEditingServer(server.name);
    setFormData({
      name: server.name,
      url: server.url,
      description: server.description,
      authToken: server.auth?.token || "",
    });
  }

  /** 关闭表单 */
  function closeForm() {
    setFormMode(null);
    setEditingServer(null);
    setFormData({
      name: "",
      url: "",
      description: "",
      authToken: "",
    });
  }

  /** 提交表单 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 验证
    if (!formData.name.trim() || !formData.url.trim()) {
      alert("请填写服务器名称和 URL");
      return;
    }

    setLoading(true);
    try {
      let success = false;

      if (formMode === "add") {
        // 添加新 Server
        const config = {
          name: formData.name.trim(),
          url: formData.url.trim(),
          description: formData.description.trim(),
          auth: formData.authToken.trim()
            ? { token: formData.authToken.trim() }
            : null,
        };
        success = await ipcEvent.invoke("add-mcp-server", config);
      } else if (formMode === "edit") {
        // 更新 Server
        const config = {
          name: editingServer!,
          url: formData.url.trim(),
          description: formData.description.trim(),
          auth: formData.authToken.trim()
            ? { token: formData.authToken.trim() }
            : null,
        };
        success = await ipcEvent.invoke("update-mcp-server", config);
      }

      if (success) {
        closeForm();
        setTimeout(() => fetchServers(), 500);
      } else {
        alert(`${formMode === "add" ? "添加" : "更新"} Server 失败`);
      }
    } catch (err) {
      console.error("提交表单失败:", err);
      alert(`${formMode === "add" ? "添加" : "更新"} Server 出错`);
    } finally {
      setLoading(false);
    }
  }

  //--------------  删除操作  --------------

  /** 确认删除 */
  function confirmDelete(name: string) {
    setDeleteConfirm(name);
  }

  /** 取消删除 */
  function cancelDelete() {
    setDeleteConfirm(null);
  }

  /** 执行删除 */
  async function executeDelete() {
    if (!deleteConfirm) return;

    setLoading(true);
    try {
      const success = await ipcEvent.invoke("remove-mcp-server", deleteConfirm);
      if (success) {
        setDeleteConfirm(null);
        setTimeout(() => fetchServers(), 500);
      } else {
        alert(`删除 Server "${deleteConfirm}" 失败`);
      }
    } catch (err) {
      console.error("删除 Server 失败:", err);
      alert("删除 Server 出错");
    } finally {
      setLoading(false);
    }
  }

  //--------------  刷新操作  --------------

  async function handleRefresh() {
    setLoading(true);
    try {
      await ipcEvent.invoke("reload-mcp-servers");
      setTimeout(() => fetchServers(), 500);
    } catch (err) {
      console.error("刷新失败:", err);
    } finally {
      setLoading(false);
    }
  }

  //--------------  鼠标穿透控制  --------------
  
  /** 处理鼠标进入面板 - 取消穿透（额外保护层） */
  function handleMouseEnter() {
    ipcEvent.emit("set-ignore-mouse-events", false, { forward: false });
  }

  /** 处理所有鼠标事件 - 确保取消穿透 */
  function handleMouseEvent(e: React.MouseEvent) {
    // 阻止事件冒泡，防止触发父组件的 mouseLeave
    e.stopPropagation();
    ipcEvent.emit("set-ignore-mouse-events", false, { forward: false });
  }

  //--------------  渲染  --------------

  if (!visible) return null;

  return (
    <div 
      className="mcp-panel"
      onMouseEnter={handleMouseEnter}
      onMouseDown={handleMouseEvent}
      onMouseMove={handleMouseEvent}
      onClick={handleMouseEvent}
    >
      {/* 头部 */}
      <div className="mcp-panel-header">
          <h3>MCP Server 管理</h3>
          <div className="header-actions">
            <button 
              className="btn-icon" 
              onClick={handleRefresh} 
              disabled={loading}
              title="刷新"
            >
              🔄
            </button>
            <button 
              className="btn-icon" 
              onClick={onClose}
              title="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 服务器列表 */}
        <div className="mcp-panel-body">
          {loading && servers.length === 0 ? (
            <div className="loading-state">加载中...</div>
          ) : servers.length === 0 ? (
            <div className="empty-state">
              <p>暂无 MCP Server</p>
              <button className="btn-primary" onClick={openAddForm}>
                添加第一个 Server
              </button>
            </div>
          ) : (
            <div className="server-list">
              {servers.map((server) => (
                <div key={server.name} className="server-item">
                  <div className="server-info">
                    <div className="server-name-row">
                      <h4>{server.name}</h4>
                      <div className="server-badges">
                        <span
                          className={`badge ${
                            server.connected ? "badge-success" : "badge-gray"
                          }`}
                        >
                          {server.connected ? "已连接" : "未连接"}
                        </span>
                        <span className="badge badge-info">
                          {server.tools_count} 工具
                        </span>
                      </div>
                    </div>
                    {server.description && (
                      <p className="server-description">{server.description}</p>
                    )}
                    <p className="server-url">{server.url}</p>
                  </div>

                  <div className="server-actions">
                    {/* Toggle 开关 */}
                    <label className="switch" title={server.enabled ? "禁用" : "启用"}>
                      <input
                        type="checkbox"
                        checked={server.enabled}
                        onChange={(e) => handleToggle(server.name, e.target.checked)}
                        disabled={loading}
                      />
                      <span className="slider"></span>
                    </label>

                    {/* 编辑按钮 */}
                    <button
                      className="btn-text btn-edit"
                      onClick={() => openEditForm(server)}
                      disabled={loading}
                      title="编辑"
                    >
                      edit
                    </button>

                    {/* 删除按钮 */}
                    <button
                      className="btn-text btn-delete"
                      onClick={() => confirmDelete(server.name)}
                      disabled={loading}
                      title="删除"
                    >
                      del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        {servers.length > 0 && !formMode && (
          <div className="mcp-panel-footer">
            <button className="btn-primary" onClick={openAddForm} disabled={loading}>
              + 添加
            </button>
          </div>
        )}

        {/* 添加/编辑表单 */}
        {formMode && (
          <div 
            className="server-form-overlay" 
            onMouseEnter={handleMouseEnter}
            onMouseDown={handleMouseEvent}
            onClick={handleMouseEvent}
          >
            <div className="server-form">
              <h4>{formMode === "add" ? "添加 Server" : "编辑 Server"}</h4>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={formMode === "edit" || loading}
                    placeholder="例如: my_mcp_server"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>URL *</label>
                  <input
                    type="text"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    disabled={loading}
                    placeholder="例如: http://localhost:3000/mcp"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    disabled={loading}
                    placeholder="简短描述此 Server 的用途"
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label>Auth Token（可选）</label>
                  <input
                    type="text"
                    value={formData.authToken}
                    onChange={(e) =>
                      setFormData({ ...formData, authToken: e.target.value })
                    }
                    disabled={loading}
                    placeholder="如需要认证，请输入 Token"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeForm}
                    disabled={loading}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading
                      ? "处理中..."
                      : formMode === "add"
                      ? "添加"
                      : "保存"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 删除确认对话框 */}
        {deleteConfirm && (
          <div 
            className="confirm-dialog-overlay" 
            onMouseEnter={handleMouseEnter}
            onMouseDown={handleMouseEvent}
            onClick={handleMouseEvent}
          >
            <div className="confirm-dialog">
              <h4>确认删除</h4>
              <p>
                确定要删除 Server <strong>{deleteConfirm}</strong> 吗？
              </p>
              <p className="warning-text">此操作无法撤销。</p>
              <div className="dialog-actions">
                <button
                  className="btn-secondary"
                  onClick={cancelDelete}
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  className="btn-danger"
                  onClick={executeDelete}
                  disabled={loading}
                >
                  {loading ? "删除中..." : "删除"}
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}


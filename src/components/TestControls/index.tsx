import React from "react";
import "./index.scss";

/**
 * 测试控制组件 - 仅在开发环境显示
 */
export const TestControls: React.FC = () => {
    const testExpressions = [
        { name: "开心", value: "happy" },
        { name: "生气", value: "angry" },
        { name: "惊讶", value: "surprised" },
        { name: "摇头", value: "shake" },
        { name: "空闲", value: "idle" },
        { name: "说话", value: "speaking" }
    ];

    const testMessages = [
        "你好！我是你的智能桌宠",
        "今天天气真不错呢",
        "我可以帮你查天气、打开应用哦",
        "点击我可以和我互动"
    ];

    const handleExpressionTest = (expression: string): void => {
        if (window.electronAPI) {
            window.electronAPI.onPetMessage(null, {
                type: "expression",
                expression
            });
        }
    };

    const handleSpeakTest = (): void => {
        const randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];

        if (window.electronAPI) {
            window.electronAPI.onPetMessage(null, {
                type: "speak",
                text: randomMessage
            });
        }
    };

    const handleRandomAction = (): void => {
        const actions = ["expression", "speak"];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];

        if (randomAction === "expression") {
            const randomExpression = testExpressions[Math.floor(Math.random() * testExpressions.length)];
            handleExpressionTest(randomExpression.value);
        } else {
            handleSpeakTest();
        }
    };

    return (
        <div className="test-controls">
            <h4 className="test-title">🧪 测试控制</h4>

            <div className="test-buttons">
                <div className="button-group">
                    <span className="group-label">表情测试:</span>
                    <div className="expression-buttons">
                        {testExpressions.map(expr => (
                            <button
                                key={expr.value}
                                className="test-btn expression-btn"
                                onClick={() => handleExpressionTest(expr.value)}
                            >
                                {expr.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="button-group">
                    <span className="group-label">交互测试:</span>
                    <div className="action-buttons">
                        <button
                            className="test-btn speak-btn"
                            onClick={handleSpeakTest}
                        >
                            测试说话
                        </button>
                        <button
                            className="test-btn random-btn"
                            onClick={handleRandomAction}
                        >
                            随机动作
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
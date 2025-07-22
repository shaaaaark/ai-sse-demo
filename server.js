const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('frontend'));

// 模拟AI回复数据
const AI_RESPONSES = [
    "你好！我是AI助手，很高兴为您服务。",
    "我可以帮助您解答各种问题，包括技术、学习、生活等方面。",
    "请告诉我您需要什么帮助，我会尽力为您提供有用的信息。",
    "作为AI助手，我可以进行多轮对话，理解上下文，并提供个性化的回答。",
    "如果您有任何疑问或需要进一步的解释，请随时告诉我！"
];

// 工具函数：模拟AI流式响应（支持Markdown格式）
function simulateAIResponse(userMessage) {
    // 根据用户消息选择合适的回复（包含Markdown格式）
    if (userMessage.includes('你好') || userMessage.includes('hi')) {
        return `# 你好！👋

很高兴见到你！我是**AI助手**，可以帮助你解答各种问题。

## 我能做什么？
- 💬 **对话交流**：进行自然的对话
- 🔍 **问题解答**：回答技术和学习问题  
- 📝 **内容创作**：帮助写作和创意
- 🛠️ **技术支持**：编程和开发建议

请告诉我你想了解什么！`;
    }
    
    if (userMessage.includes('帮助') || userMessage.includes('help')) {
        return `## 我可以为您提供以下帮助：

### 📚 学习支持
- 解答技术问题
- 提供学习建议
- 知识点解释

### 💻 编程协助
- 代码审查和优化
- 算法和数据结构
- 最佳实践建议

### 🔧 技术咨询
- 架构设计建议
- 工具选型指导
- 问题排查思路

> **提示**：请告诉我你的具体需求，我会提供更有针对性的帮助！

有什么具体问题吗？`;
    }
    
    if (userMessage.includes('谢谢') || userMessage.includes('thank')) {
        return `## 不用客气！😊

能帮助到你我很开心！如果还有其他问题，请随时提问。

### 继续交流
- 🤔 有新的疑问？
- 💡 需要更多建议？
- 🔍 想了解其他话题？

我随时在这里为你服务！`;
    }
    
    if (userMessage.includes('markdown') || userMessage.includes('Markdown')) {
        return `# Markdown 语法演示

你提到了Markdown！让我展示一些常用的语法：

## 文本格式
- **粗体文本**
- *斜体文本*
- \`行内代码\`
- ~~删除线~~

## 列表
### 无序列表
- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2

### 有序列表
1. 第一项
2. 第二项
3. 第三项

## 代码块
\`\`\`javascript
function sayHello(name) {
    console.log(\`Hello, \${name}!\`);
}
\`\`\`

## 引用
> 这是一个引用示例
> 可以包含多行内容

## 表格
| 特性 | SSE | WebSocket |
|------|-----|-----------|
| 方向 | 单向 | 双向 |
| 复杂度 | 简单 | 复杂 |

---

希望这个演示对你有帮助！`;
    }
    
    // 默认回复（包含一些Markdown格式）
    return `## 关于 "${userMessage}"

这是一个很有趣的问题！让我从几个角度来分析：

### 🔍 问题分析
基于我的理解，这个问题涉及到多个方面的考虑：

1. **核心要素分析**
   - 需要识别关键信息
   - 理解问题的本质

2. **多角度思考**
   - 从不同维度审视问题
   - 考虑各种可能性

3. **系统性方法**
   - 采用结构化的解决思路
   - 循序渐进地处理

### 💡 建议
> 我建议采用**系统性的方法**来处理这个问题，这样可以确保考虑周全。

希望这个回答对你有帮助！如果需要更详细的解释，请告诉我。`;
}

// 工具函数：将文本分割成字符数组，保持中文字符完整性
function splitTextForStreaming(text) {
    const chars = [];
    for (let i = 0; i < text.length; i++) {
        chars.push(text[i]);
    }
    return chars;
}

// SSE路由：AI流式聊天
app.get('/ai/stream', (req, res) => {
    const userMessage = req.query.message || '';
    
    console.log(`[${new Date().toISOString()}] 收到用户消息: ${userMessage}`);
    
    // 设置SSE响应头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no' // 禁用nginx缓冲
    });

    // 发送连接确认
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'AI正在思考...' })}\n\n`);

    // 模拟AI思考延迟
    setTimeout(() => {
        const aiResponse = simulateAIResponse(userMessage);
        const chars = splitTextForStreaming(aiResponse);
        let charIndex = 0;

        // 流式发送AI回复
        const streamInterval = setInterval(() => {
            if (charIndex < chars.length) {
                const char = chars[charIndex];
                res.write(`data: ${JSON.stringify({ 
                    type: 'content', 
                    content: char,
                    index: charIndex,
                    total: chars.length 
                })}\n\n`);
                charIndex++;
            } else {
                // 发送完成信号
                res.write(`data: ${JSON.stringify({ 
                    type: 'done', 
                    message: '回复完成',
                    timestamp: new Date().toISOString()
                })}\n\n`);
                clearInterval(streamInterval);
                res.end();
                console.log(`[${new Date().toISOString()}] AI回复完成`);
            }
        }, 30 + Math.random() * 50); // 30-80ms间隔，模拟真实的打字速度

        // 连接断开检测
        req.on('close', () => {
            clearInterval(streamInterval);
            console.log(`[${new Date().toISOString()}] 客户端断开连接`);
        });

    }, 500 + Math.random() * 1000); // 500-1500ms思考时间
});

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 获取聊天历史接口（模拟）
app.get('/api/chat/history', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: 1,
                userMessage: "你好",
                aiResponse: "你好！我是AI助手，很高兴为您服务。",
                timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 2,
                userMessage: "什么是SSE？",
                aiResponse: "SSE（Server-Sent Events）是一种基于HTTP的服务器推送技术...",
                timestamp: new Date(Date.now() - 1800000).toISOString()
            }
        ]
    });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 AI SSE聊天服务器启动成功！`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`📡 SSE接口: http://localhost:${PORT}/ai/stream`);
    console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
    console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在优雅关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('收到SIGINT信号，正在优雅关闭服务器...');
    process.exit(0);
}); 
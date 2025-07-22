/**
 * AI聊天助手 - 前端应用逻辑
 * 基于SSE (Server-Sent Events) 实现流式AI对话
 */

class ChatApp {
    constructor() {
        this.currentEventSource = null;
        this.isConnected = false;
        this.messageHistory = [];
        this.currentAIMessage = '';
        this.currentMessageElement = null;
        
        this.initElements();
        this.bindEvents();
        this.updateConnectionStatus('ready', '准备就绪');
    }

    // 初始化DOM元素引用
    initElements() {
        this.elements = {
            messagesContainer: document.getElementById('messages-container'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            connectionStatus: document.getElementById('connection-status'),
            statusText: document.getElementById('status-text'),
            charCount: document.querySelector('.char-count'),
            loadingOverlay: document.getElementById('loading-overlay')
        };
    }

    // 绑定事件监听器
    bindEvents() {
        // 发送按钮点击事件
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        
        // 输入框事件
        this.elements.messageInput.addEventListener('input', () => this.handleInputChange());
        this.elements.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // 自动调整输入框高度
        this.elements.messageInput.addEventListener('input', () => this.autoResizeTextarea());
        
        // 侧边栏切换
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        
        // 清空历史按钮
        const clearHistory = document.getElementById('clear-history');
        if (clearHistory) {
            clearHistory.addEventListener('click', () => this.clearHistory());
        }
        
        // 页面卸载时关闭连接
        window.addEventListener('beforeunload', () => this.closeConnection());
    }

    // 处理输入框变化
    handleInputChange() {
        const input = this.elements.messageInput;
        const value = input.value.trim();
        const length = value.length;
        
        // 更新字符计数
        this.elements.charCount.textContent = `${length}/1000`;
        
        // 控制发送按钮状态
        this.elements.sendButton.disabled = length === 0 || this.isConnected;
    }

    // 处理键盘事件
    handleKeyDown(e) {
        if (e.key === 'Enter') {
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Enter 发送消息
                e.preventDefault();
                this.sendMessage();
            } else if (!e.shiftKey) {
                // Enter 发送消息（除非按住Shift）
                e.preventDefault();
                this.sendMessage();
            }
        }
    }

    // 自动调整输入框高度
    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // 发送消息
    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message || this.isConnected) {
            return;
        }

        try {
            // 添加用户消息到界面
            this.addUserMessage(message);
            
            // 清空输入框
            this.elements.messageInput.value = '';
            this.elements.messageInput.style.height = 'auto';
            this.handleInputChange();
            
            // 开始AI流式响应
            await this.startAIStream(message);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            this.showError('发送消息失败，请重试');
            this.updateConnectionStatus('error', '连接错误');
        }
    }

    // 添加用户消息到界面
    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="message-avatar">我</div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message)}</div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        // 保存到历史记录
        this.messageHistory.push({
            type: 'user',
            content: message,
            timestamp: new Date()
        });
    }

    // 开始AI流式响应
    async startAIStream(userMessage) {
        this.updateConnectionStatus('connecting', '连接中...');
        this.isConnected = true;
        this.currentAIMessage = '';
        
        // 创建AI消息元素
        this.createAIMessageElement();
        
        try {
            // 构建SSE连接URL
            const params = new URLSearchParams({
                message: userMessage
            });
            
            const url = `/ai/stream?${params.toString()}`;
            this.currentEventSource = new EventSource(url);
            
            // 处理SSE事件
            this.currentEventSource.onopen = () => {
                this.updateConnectionStatus('connected', '已连接');
                console.log('SSE连接已建立');
            };
            
            this.currentEventSource.onmessage = (event) => {
                this.handleSSEMessage(event);
            };
            
            this.currentEventSource.onerror = (error) => {
                console.error('SSE连接错误:', error);
                this.handleSSEError();
            };
            
        } catch (error) {
            console.error('启动SSE流失败:', error);
            this.handleSSEError();
        }
    }

    // 处理SSE消息
    handleSSEMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'connected':
                    this.showTypingIndicator();
                    break;
                    
                case 'content':
                    this.hideTypingIndicator();
                    this.appendAIContent(data.content);
                    break;
                    
                case 'done':
                    this.finishAIResponse();
                    break;
                    
                default:
                    console.warn('未知的SSE消息类型:', data.type);
            }
        } catch (error) {
            console.error('解析SSE消息失败:', error, event.data);
        }
    }

    // 创建AI消息元素
    createAIMessageElement() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        messageDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="message-text" id="current-ai-text"></div>
                <div class="typing-indicator" id="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
                <div class="message-time" id="current-ai-time" style="display: none;"></div>
            </div>
        `;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.currentMessageElement = messageDiv;
        this.scrollToBottom();
    }

    // 显示打字指示器
    showTypingIndicator() {
        // 优先使用当前消息元素中的typing-indicator，避免ID冲突
        if (this.currentMessageElement) {
            const indicator = this.currentMessageElement.querySelector('#typing-indicator') || 
                            this.currentMessageElement.querySelector('.typing-indicator');
            if (indicator) {
                indicator.style.display = 'flex';
            }
        } else {
            // 备选方案：使用全局ID查找
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                indicator.style.display = 'flex';
            }
        }
    }

    // 隐藏打字指示器
    hideTypingIndicator() {
        // 优先使用当前消息元素中的typing-indicator，避免ID冲突
        if (this.currentMessageElement) {
            const indicator = this.currentMessageElement.querySelector('#typing-indicator') || 
                            this.currentMessageElement.querySelector('.typing-indicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        } else {
            // 备选方案：使用全局ID查找
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        }
    }

    // 追加AI内容（打字机效果）
    appendAIContent(content) {
        this.currentAIMessage += content;
        const textElement = document.getElementById('current-ai-text');
        
        if (textElement) {
            // 使用requestAnimationFrame确保流畅的渲染
            requestAnimationFrame(() => {
                // 使用marked.js解析Markdown内容
                if (typeof marked !== 'undefined') {
                    textElement.innerHTML = marked.parse(this.currentAIMessage);
                } else {
                    // 备选方案：纯文本显示
                    textElement.textContent = this.currentAIMessage;
                }
                this.scrollToBottom();
            });
        }
    }

    // 完成AI响应
    finishAIResponse() {
        this.closeConnection();
        this.hideTypingIndicator();
        
        // 显示时间戳
        const timeElement = document.getElementById('current-ai-time');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString();
            timeElement.style.display = 'block';
        }
        
        // 清理ID（避免重复）
        if (this.currentMessageElement) {
            const textElement = this.currentMessageElement.querySelector('#current-ai-text');
            const timeElement = this.currentMessageElement.querySelector('#current-ai-time');
            const typingElement = this.currentMessageElement.querySelector('#typing-indicator');
            
            if (textElement) textElement.removeAttribute('id');
            if (timeElement) timeElement.removeAttribute('id');
            if (typingElement) typingElement.removeAttribute('id');
        }
        
        // 保存到历史记录
        this.messageHistory.push({
            type: 'ai',
            content: this.currentAIMessage,
            timestamp: new Date()
        });
        
        this.updateConnectionStatus('ready', '准备就绪');
        console.log('AI响应完成');
    }

    // 处理SSE错误
    handleSSEError() {
        this.closeConnection();
        this.hideTypingIndicator();
        
        if (this.currentMessageElement) {
            const textElement = document.getElementById('current-ai-text');
            if (textElement) {
                textElement.textContent = this.currentAIMessage || '连接中断，请重试';
                textElement.style.color = 'var(--error-color)';
            }
        }
        
        this.showError('连接中断，请重试');
        this.updateConnectionStatus('error', '连接错误');
    }

    // 关闭SSE连接
    closeConnection() {
        if (this.currentEventSource) {
            this.currentEventSource.close();
            this.currentEventSource = null;
        }
        this.isConnected = false;
        this.elements.sendButton.disabled = this.elements.messageInput.value.trim().length === 0;
    }

    // 更新连接状态
    updateConnectionStatus(status, text) {
        const statusColors = {
            ready: 'var(--success-color)',
            connecting: 'var(--warning-color)',
            connected: 'var(--primary-color)',
            error: 'var(--error-color)'
        };
        
        this.elements.connectionStatus.style.background = statusColors[status] || statusColors.ready;
        this.elements.statusText.textContent = text;
    }

    // 滚动到底部
    scrollToBottom() {
        requestAnimationFrame(() => {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        });
    }

    // 显示错误消息
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        document.querySelector('.app-container').appendChild(errorDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 获取聊天历史
    getChatHistory() {
        return this.messageHistory;
    }

    // 切换侧边栏
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebar-toggle');
        
        if (sidebar && toggle) {
            const isOpen = sidebar.classList.contains('open');
            
            if (isOpen) {
                sidebar.classList.remove('open');
                toggle.classList.remove('active');
            } else {
                sidebar.classList.add('open');
                toggle.classList.add('active');
                this.updateSidebarHistory();
            }
        }
    }

    // 更新侧边栏历史记录
    updateSidebarHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        if (this.messageHistory.length === 0) {
            historyList.innerHTML = '<div class="history-empty"><p>暂无聊天记录</p></div>';
            return;
        }

        // 按对话分组显示历史记录
        const conversations = [];
        let currentConversation = [];
        
        this.messageHistory.forEach(msg => {
            if (msg.type === 'user') {
                if (currentConversation.length > 0) {
                    conversations.push([...currentConversation]);
                }
                currentConversation = [msg];
            } else if (msg.type === 'ai' && currentConversation.length > 0) {
                currentConversation.push(msg);
            }
        });
        
        if (currentConversation.length > 0) {
            conversations.push(currentConversation);
        }

        historyList.innerHTML = conversations.map((conv, index) => {
            const userMsg = conv.find(m => m.type === 'user');
            const time = userMsg ? new Date(userMsg.timestamp).toLocaleTimeString() : '';
            const preview = userMsg ? userMsg.content.substring(0, 30) + (userMsg.content.length > 30 ? '...' : '') : '';
            
            return `
                <div class="history-item" data-index="${index}">
                    <div class="history-preview">${preview}</div>
                    <div class="history-time">${time}</div>
                </div>
            `;
        }).join('');

        // 绑定历史记录点击事件
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.loadHistoryConversation(conversations[index]);
            });
        });
    }

    // 加载历史对话
    loadHistoryConversation(conversation) {
        // 清空当前对话
        const welcomeMessage = this.elements.messagesContainer.querySelector('.welcome-message');
        this.elements.messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            this.elements.messagesContainer.appendChild(welcomeMessage);
        }

        // 重新显示历史对话
        conversation.forEach(msg => {
            if (msg.type === 'user') {
                this.addUserMessage(msg.content);
            } else if (msg.type === 'ai') {
                this.addAIMessage(msg.content);
            }
        });
    }

    // 添加AI消息到界面（不通过流式）
    addAIMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        messageDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="message-text"></div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        const textElement = messageDiv.querySelector('.message-text');
        if (typeof marked !== 'undefined') {
            textElement.innerHTML = marked.parse(content);
        } else {
            textElement.textContent = content;
        }
        
        this.elements.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    // 清空聊天历史
    clearHistory() {
        if (confirm('确定要清空所有聊天记录吗？')) {
            this.messageHistory = [];
            
            // 清空界面，保留欢迎消息
            const welcomeMessage = this.elements.messagesContainer.querySelector('.welcome-message');
            this.elements.messagesContainer.innerHTML = '';
            if (welcomeMessage) {
                this.elements.messagesContainer.appendChild(welcomeMessage);
            }
            
            // 更新侧边栏
            this.updateSidebarHistory();
        }
    }
}

// 工具函数：格式化时间
function formatTime(date) {
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 工具函数：获取随机ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
    console.log('AI聊天助手初始化完成');
});

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChatApp };
} 
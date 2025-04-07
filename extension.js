const vscode = require('vscode');
const fetch = require('node-fetch'); // Make sure this is installed with `npm install node-fetch`

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const provider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("chatAssistantView", provider)
  );
}

class ChatViewProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
    this.panel = null;
  }

  resolveWebviewView(webviewView) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'ask') {
        const question = message.text;

        try {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'tinyllama',
              prompt: question,
              stream: false
            })
          });

          const data = await response.json();
          webviewView.webview.postMessage({ type: 'response', text: data.response });
        } catch (err) {
          webviewView.webview.postMessage({ type: 'response', text: 'Error: ' + err.message });
        }
      }
    });
  }

  getHtml() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      margin: 0;
      background-color: #1e1e1e;
      color: white;
      display: flex;
      height: 100vh;
    }

    .sidebar {
      width: 220px;
      background-color: #252526;
      padding: 10px;
      border-right: 1px solid #333;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .prompt-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sidebar-search {
      margin-top: auto;
      padding: 10px;
      margin-right: 20px;
    }

    .sidebar h3 {
      margin: 0 0 10px;
      font-size: 16px;
      color: #0e84d8;
    }

    .sidebar button {
      background-color: #2d2d30;
      border: none;
      color: white;
      padding: 8px;
      text-align: left;
      border-radius: 4px;
      cursor: pointer;
    }

    .sidebar button:hover {
      background-color: #3a3d41;
    }

    .main-container {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    header {
      background-color: #007acc;
      padding: 10px 16px;
      font-size: 18px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .chat-container {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .message {
      margin: 10px 0;
      padding: 10px 14px;
      border-radius: 8px;
      max-width: 70%;
      line-height: 1.5;
      word-wrap: break-word;
      position: relative;
    }

    .user {
      align-self: flex-end;
      background-color: #3a3d41;
    }

    .assistant {
      align-self: flex-start;
      background-color: #2d2d30;
    }

    .timestamp {
      font-size: 10px;
      color: #aaa;
      margin-top: 4px;
      text-align: right;
    }

    .input-bar {
      display: flex;
      flex-direction: column;
      padding: 10px 14px;
      padding-right: 30px;
      background-color:rgb(38, 35, 35);
      border-top: 1px solid #333;
    }

    .chat-input-container {
      display: flex;
      align-items: center;
      background-color: #1e1e1e;
      border: 1px solid #3c3c3c;
      border-radius: 6px;
      padding: 6px 8px;
      width: 100%;
    }

    .chat-input-container input[type="text"] {
      flex: 1;
      background-color: transparent;
      border: none;
      outline: none;
      font-size: 14px;
      color: white;
      padding-left: 6px;
    }

    .chat-input-container .icon,
    .chat-input-container .send-btn,
    .chat-input-container .mic-btn {
      font-size: 18px;
      color: white;
      margin: 0 10px;
      cursor: pointer;
      transition: color 0.2s ease;
    }

    .send-arrow {
      display: inline-block;
      transform: rotate(45deg);
      transition: transform 0.2s ease;
    }

    .send-btn:hover .send-arrow {
      transform: translateX(3px) rotate(45deg);
    }

    .search-box-bottom {
      padding: 8px;
      border-radius: 6px;
      background: #333;
      border: none;
      color: white;
      font-size: 14px;
      width: 100%;
    }
  </style>
</head>
<body>
 

  <div class="main-container">
    <header>
      🤖 Chat Assistant
    </header>

    <div class="chat-container" id="chat"></div>

    <div class="input-bar">
      <div class="chat-input-container">
        <label for="file-upload" class="icon">📎</label>
        <input type="file" id="file-upload" style="display: none" />
        <input type="text" id="input" placeholder="Ask your coding question..." onkeydown="handleKey(event)" />
        <span class="mic-btn" onclick="startVoice()">🎤</span>
        <span class="send-btn" onclick="send()">
          <span class="send-arrow">➤</span>
        </span>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const chat = document.getElementById("chat");
    const input = document.getElementById("input");
    let chatHistory = [];

    function addMessage(message, sender) {
      const msgDiv = document.createElement("div");
      msgDiv.className = "message " + sender;

      const msgText = document.createElement("span");
      msgText.textContent = message;

      const timestamp = document.createElement("div");
      timestamp.className = "timestamp";
      timestamp.textContent = new Date().toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit'
      });

      msgDiv.appendChild(msgText);
      msgDiv.appendChild(timestamp);

      chat.appendChild(msgDiv);
      chat.scrollTop = chat.scrollHeight;

      chatHistory.push({ sender, message });
    }

    function send() {
      const msg = input.value.trim();
      if (msg === "") return;
      addMessage(msg, "user");
      vscode.postMessage({ command: 'ask', text: msg });
      input.value = "";
    }

    function handleKey(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      }
    }

    function setQuickPrompt(prompt) {
      input.value = prompt;
      input.focus();
    }

    function startVoice() {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = 'en-US';
      recognition.onresult = function(event) {
        input.value = event.results[0][0].transcript;
        send();
      };
      recognition.start();
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'response') {
        addMessage(message.text, 'assistant');
      }
    });
  </script>
</body>
</html>
    `;
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
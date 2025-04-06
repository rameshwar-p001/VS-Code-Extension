const vscode = require('vscode');
const http = require('http');

function activate(context) {
  const provider = new ChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('chatAssistantView', provider)
  );

  // ✅ Register command to open the view manually
  context.subscriptions.push(
    vscode.commands.registerCommand('chatAssistant.start', () => {
      vscode.commands.executeCommand('workbench.view.extension.chatAssistantSidebar');
    })
  );
}

class ChatViewProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
    };

    webview.html = this.getHtml();

    webview.onDidReceiveMessage(async message => {
      if (message.command === 'userMessage') {
        const userText = message.text;
        const response = await this.queryLocalLLM(userText);

        webview.postMessage({
          command: 'botReply',
          user: userText,
          bot: response
        });
      }
    });
  }

  async queryLocalLLM(prompt) {
    const data = JSON.stringify({
      model: 'deepseek-coder',
      prompt,
      stream: false
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const lastLine = body.trim().split('\n').pop();
            const parsed = JSON.parse(lastLine);
            resolve(parsed.response || '[No response]');
          } catch (err) {
            resolve('[Error parsing response]');
          }
        });
      });

      req.on('error', err => resolve('[Request Error] ' + err.message));
      req.write(data);
      req.end();
    });
  }

  getHtml() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          background-color: #1e1e1e;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          color: white;
        }

        #chat-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .message {
          padding: 0.75rem 1rem;
          border-radius: 16px;
          margin-bottom: 0.5rem;
          max-width: 75%;
          word-wrap: break-word;
          animation: fadeIn 0.3s ease-in-out;
        }

        .user {
          align-self: flex-end;
          background-color: #0e639c;
          text-align: right;
        }

        .assistant {
          align-self: flex-start;
          background: linear-gradient(135deg, #444 0%, #3a3d41 100%);
        }

        #input-container {
          display: flex;
          padding: 0.75rem;
          border-top: 1px solid #333;
          background-color: #252526;
        }

        textarea {
          flex: 1;
          resize: none;
          height: 50px;
          border-radius: 10px;
          border: none;
          padding: 0.5rem 0.75rem;
          font-size: 14px;
          outline: none;
        }

        button {
          margin-left: 0.5rem;
          background-color: #0e639c;
          border: none;
          color: white;
          padding: 0 1.25rem;
          border-radius: 10px;
          font-size: 14px;
          cursor: pointer;
        }

        button:hover {
          background-color: #1177bb;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <div id="chat-container"></div>
      <div id="input-container">
        <textarea id="input" placeholder="Type your message..."></textarea>
        <button onclick="send()">Send</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        const chat = document.getElementById('chat-container');
        const input = document.getElementById('input');

        function addMessage(text, sender) {
          const msg = document.createElement('div');
          msg.className = 'message ' + sender;
          msg.innerText = text;
          chat.appendChild(msg);
          chat.scrollTop = chat.scrollHeight;
        }

        function send() {
          const text = input.value.trim();
          if (!text) return;

          addMessage(text, 'user');
          input.value = '';

          const loadingMsg = document.createElement('div');
          loadingMsg.className = 'message assistant';
          loadingMsg.innerText = 'Typing...';
          chat.appendChild(loadingMsg);
          chat.scrollTop = chat.scrollHeight;

          vscode.postMessage({ command: 'userMessage', text });

          window.addEventListener('message', event => {
            const data = event.data;
            if (data.command === 'botReply') {
              loadingMsg.innerText = data.bot;
            }
          }, { once: true });
        }

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
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

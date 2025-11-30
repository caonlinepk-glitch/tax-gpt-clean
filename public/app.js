/* app.js
   Frontend JS for CAOnline AI Chat
   Fully functional, error-proof conversation grouping and history
*/

// ---- Configuration ----
// Update endpoint to match Vercel serverless function
const OPENAI_API_ENDPOINT = "/api/gpt";

// ---- State ----
const SYSTEM_MESSAGE = {
  role: "system",
  content: `
You are a Pakistani Tax Expert GPT. 
1. Give text explanations in natural readable sentences.
2. Give tables exactly as humans would write them (plain table format, no JSON, no code blocks). The table should be readable with columns and rows clearly.
3. Flowcharts/trees should be drawn with arrows, └, │, etc.
4. Never tell the user to consult others — you are the expert.
5. Always cite laws, circulars, or rates when relevant.
6. Tables should be rendered in frontend as HTML tables automatically — text stays text.
7. Numbers and rates must follow Pakistan context.
8. Always use the latest provincial Acts, 2023 Place-of-Provision Rules, FBR/SRB/PRA circulars, and relevant case law.
9. Cite official sources, PDFs, and judgments whenever possible.
10. Give step-by-step guidance for practical application.
11. Highlight digital, mixed, or partially delivered services.
12. if the user asks or discusses anything outside the scope of the topic (taxation and tax laws of Pakistan), decline politely.
13. NEVER guess or create fake sections, clauses or laws.
14. Temperature must stay zero for accuracy.
15. Always search the given words and sections in relevant law first, then reply. If unsure, tell the user politely that your knowledge base is being updated, and you will be able to give an appropriate reply soon.

`
};

let chatHistory = [SYSTEM_MESSAGE];
let conversations = [];
let currentConversation = { title: "", history: [] };

// ---- DOM Elements ----
const messagesEl = document.getElementById("messages");
const userInputEl = document.getElementById("userInput");
const composer = document.getElementById("composer");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const historyEl = document.getElementById("history");
const clearBtn = document.getElementById("clearBtn");
const themeToggle = document.getElementById("themeToggle");

// ---- Theme Init ----
(function initTheme() {
  const theme = localStorage.getItem("caonline_theme") || "light";
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
})();

// ---- Helpers ----
function getConversationTitle(userText) {
  if (!currentConversation.title) {
    currentConversation.title = userText.slice(0, 40) || "New Chat";
  }
  return currentConversation.title;
}

function addMessageToConversation(role, text) {
  chatHistory.push({ role, content: text });
  currentConversation.history.push({ role, content: text });
}

// ---- Render History ----
function renderHistory() {
  historyEl.innerHTML = "";
  conversations.forEach((conv, idx) => {
    const el = document.createElement("div");
    el.className = "item";
    el.textContent = conv.title || "Chat " + (idx + 1);
    el.onclick = () => loadConversation(idx);
    historyEl.appendChild(el);
  });
}

function loadConversation(idx) {
  const conv = conversations[idx];
  if (!conv) return;

  messagesEl.innerHTML = "";
  chatHistory = [SYSTEM_MESSAGE];
  currentConversation = conv;

  conv.history.forEach(msg => {
    addMessageBubble(msg.content, msg.role === "user" ? "user" : "bot");
    chatHistory.push(msg);
  });
}

// ---- Add Message Bubble ----
function addMessageBubble(text, who = "bot") {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${who}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = who === "bot" ? "A" : "Y";

  const bubble = document.createElement("div");
  bubble.className = "bubble " + who;

  let cleanText = text.trim();

  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```(json)?/, "").replace(/```$/, "").trim();
  }

  if (who === "bot") {
    const treeIndicators = ["└", "├", "│", "→", "=>"];
    const isTree = treeIndicators.some(ind => cleanText.includes(ind));

    if (isTree) {
      const pre = document.createElement("pre");
      pre.className = "tree-block";
      pre.textContent = cleanText;
      bubble.appendChild(pre);
    } else {
      let htmlContent = marked.parse(cleanText);
      htmlContent = htmlContent
        .replace(/<table>/g, '<div class="table-inline"><table class="ai-table">')
        .replace(/<\/table>/g, '</table></div>');
      bubble.innerHTML = htmlContent;
    }
  } else {
    bubble.innerHTML = simpleMarkdown(cleanText);
  }

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.title = "Copy";
  copyBtn.textContent = "📋";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "✅";
      setTimeout(() => copyBtn.textContent = "📋", 900);
    }).catch(() => alert("Copy failed"));
  };
  bubble.appendChild(copyBtn);

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---- Simple Markdown ----
function simpleMarkdown(md) {
  return md
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

// ---- Send Message ----
async function sendMessageToAPI(userText) {
  getConversationTitle(userText);

  addMessageBubble(userText, "user");
  addMessageToConversation("user", userText);

  addMessageBubble("...", "bot"); // typing placeholder

  try {
    const payload = { messages: chatHistory };
    const res = await fetch(OPENAI_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data = await res.json();

    if (messagesEl.lastChild) messagesEl.lastChild.remove();

    let reply = data?.reply || "Error: No reply from server";
    if (reply.startsWith("```")) {
      reply = reply.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }

    addMessageToConversation("assistant", reply);
    addMessageBubble(reply, "bot");

    if (!conversations.includes(currentConversation)) {
      conversations.unshift(currentConversation);
    }
    renderHistory();

  } catch (err) {
    if (messagesEl.lastChild) messagesEl.lastChild.remove();
    addMessageBubble("Error: " + (err.message || err), "bot");
    console.error(err);
  }
}

// ---- Event Listeners ----
composer.addEventListener("submit", e => {
  e.preventDefault();
  const text = userInputEl.value.trim();
  if (!text) return;
  userInputEl.value = "";
  sendMessageToAPI(text);
});

userInputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

newChatBtn.addEventListener("click", () => {
  if (currentConversation.history.length && !conversations.includes(currentConversation)) {
    conversations.unshift(currentConversation);
  }
  chatHistory = [SYSTEM_MESSAGE];
  messagesEl.innerHTML = "";
  currentConversation = { title: "", history: [] };
  addMessageBubble("New chat started. Ask about Taxation in Pakistan.", "bot");
  renderHistory();
});

clearBtn.addEventListener("click", () => {
  if (confirm("Clear all local messages?")) {
    messagesEl.innerHTML = "";
    chatHistory = [SYSTEM_MESSAGE];
    conversations = [];
    currentConversation = { title: "", history: [] };
    historyEl.innerHTML = "";
    addMessageBubble("Cleared. Start a new chat.", "bot");
  }
});

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("caonline_theme", next);
  themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
});

// ---- Init Welcome ----
addMessageBubble("Hello — I'm focused on Taxation & Tax Laws of Pakistan. Ask me anything.", "bot");

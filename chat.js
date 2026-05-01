/* Mandarin AI Chat — calls the Claude API directly from the browser.
   The API key is saved only in localStorage and sent only to api.anthropic.com.
   Uses output_config.format for guaranteed-parseable JSON responses. */

const CHAT_HISTORY_KEY = "mandarin_chat_history_v1";
const CHAT_PREFS_KEY   = "mandarin_chat_prefs_v1";
const API_KEY_STORAGE  = "mandarin_api_key_v1";

const MODELS = [
  { id: "claude-opus-4-7",   label: "Opus 4.7 — most capable" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced" },
  { id: "claude-haiku-4-5",  label: "Haiku 4.5 — fastest, cheapest" }
];

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "array",
      description: "Mandarin response — one entry per sentence or phrase.",
      items: {
        type: "object",
        properties: {
          hanzi:   { type: "string", description: "Simplified Chinese characters" },
          pinyin:  { type: "string", description: "Pinyin with tone marks (ā á ǎ à)" },
          english: { type: "string", description: "Concise English translation" }
        },
        required: ["hanzi", "pinyin", "english"],
        additionalProperties: false
      }
    },
    correction_note: {
      type: "string",
      description: "If the learner's Chinese had a mistake, a brief English correction. Empty string if none needed."
    }
  },
  required: ["reply", "correction_note"],
  additionalProperties: false
};

const buildSystemPrompt = (level) => `You are 老师 (Lǎoshī), a warm and patient Mandarin Chinese tutor.

Your job: have a real Mandarin conversation with the learner and keep them talking.

Learner level: ${level}
- Beginner: HSK 1–2 vocabulary. Short, common sentences.
- Intermediate: HSK 3–4. Longer sentences, broader topics.
- Advanced: HSK 5–6. Idioms, chengyu, nuanced grammar OK.

Rules:
1. Always respond in simplified Mandarin with pinyin (tone marks: ā á ǎ à) and concise English.
2. Keep replies short — 1 to 3 sentences. Aim for back-and-forth.
3. End every turn with a question or prompt that invites a reply.
4. The learner may write in Chinese, pinyin, or English. You always respond in Chinese.
5. If the learner's Chinese has a mistake, fill correction_note with a brief English explanation; leave it empty otherwise.
6. Each Chinese sentence is one entry in the reply array, with matching pinyin and English.

Output ONLY valid JSON matching the schema. No prose outside the JSON.`;

let chatHistory = [];
let chatPrefs   = { model: "claude-opus-4-7", level: "Beginner" };
let chatBusy    = false;

function loadChatState() {
  try { chatHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]"); }
  catch { chatHistory = []; }
  try { chatPrefs = { ...chatPrefs, ...JSON.parse(localStorage.getItem(CHAT_PREFS_KEY) || "{}") }; }
  catch {}
}
function saveChatHistory() { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory)); }
function saveChatPrefs()   { localStorage.setItem(CHAT_PREFS_KEY,   JSON.stringify(chatPrefs)); }
function getApiKey() { return localStorage.getItem(API_KEY_STORAGE) || ""; }
function setApiKey(k) {
  if (k) localStorage.setItem(API_KEY_STORAGE, k);
  else   localStorage.removeItem(API_KEY_STORAGE);
}

async function callClaude(userText) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Set your Anthropic API key in Settings to start.");

  chatHistory.push({ role: "user", content: userText });

  const body = {
    model: chatPrefs.model,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    cache_control: { type: "ephemeral" },
    system: buildSystemPrompt(chatPrefs.level),
    messages: chatHistory,
    output_config: {
      format: { type: "json_schema", schema: RESPONSE_SCHEMA }
    }
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let msg = `API error ${response.status}`;
    try {
      const err = await response.json();
      if (err?.error?.message) msg = err.error.message;
    } catch {}
    if (response.status === 401) msg = "Invalid API key. Update it in Settings.";
    if (response.status === 429) msg = "Rate limited. Wait a moment and try again.";
    chatHistory.pop();
    throw new Error(msg);
  }

  const data = await response.json();
  const textBlock = data.content.find(b => b.type === "text");
  if (!textBlock) throw new Error("Empty response from model.");

  chatHistory.push({ role: "assistant", content: textBlock.text });
  saveChatHistory();
  return JSON.parse(textBlock.text);
}

const $c = (id) => document.getElementById(id);

function renderChat() {
  const thread = $c("chatThread");
  const apiKey = getApiKey();
  const input  = $c("chatInput");
  const send   = $c("chatSend");

  $c("chatStatus").textContent =
    `${MODELS.find(m => m.id === chatPrefs.model)?.label.split(" — ")[0] || chatPrefs.model} · ${chatPrefs.level}`;

  if (!apiKey) {
    thread.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">🤖</div>
        <h3>Practice with an AI tutor</h3>
        <p>Have a conversation in Mandarin with Claude.<br/>Set your Anthropic API key to start.</p>
        <button class="btn btn-next" id="setupApiBtn">Set API key</button>
        <p class="chat-empty-note">Your key is stored only in this browser. Get one at
          <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>.</p>
      </div>`;
    $c("setupApiBtn").onclick = openChatSettings;
    input.disabled = true;
    send.disabled  = true;
    return;
  }

  input.disabled = chatBusy;
  send.disabled  = chatBusy;

  if (chatHistory.length === 0 && !chatBusy) {
    thread.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">👋</div>
        <h3>你好!</h3>
        <p>Type something in Chinese, pinyin, or English to start.</p>
        <p class="chat-empty-note">Try: <em>"你好"</em> &middot; <em>"How do I say good morning?"</em> &middot; <em>"wo hen hao"</em></p>
      </div>`;
    return;
  }

  thread.innerHTML = "";
  chatHistory.forEach(msg => {
    if (msg.role === "user") {
      const el = document.createElement("div");
      el.className = "chat-msg user";
      el.textContent = msg.content;
      thread.appendChild(el);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "chat-msg bot";
    try {
      const data = JSON.parse(msg.content);
      if (data.correction_note && data.correction_note.trim()) {
        const note = document.createElement("div");
        note.className = "correction-note";
        note.textContent = "✏️ " + data.correction_note;
        wrap.appendChild(note);
      }
      (data.reply || []).forEach(item => {
        const card = document.createElement("div");
        card.className = "bot-card";
        card.innerHTML = `
          <div class="bot-card-text">
            <div class="bot-hanzi">${item.hanzi}</div>
            <div class="bot-pinyin">${colorizePinyin(item.pinyin)}</div>
            <div class="bot-english">${item.english}</div>
          </div>
          <button class="speaker-mini" aria-label="speak">🔊</button>
        `;
        card.querySelector(".speaker-mini").onclick = () => speak(item.hanzi);
        card.querySelector(".bot-hanzi").onclick    = () => speak(item.hanzi);
        wrap.appendChild(card);
      });
    } catch {
      wrap.textContent = msg.content;
    }
    thread.appendChild(wrap);
  });

  if (chatBusy) {
    const el = document.createElement("div");
    el.className = "chat-msg bot typing";
    el.innerHTML = `<span class="dots"><span></span><span></span><span></span></span>`;
    thread.appendChild(el);
  }

  thread.scrollTop = thread.scrollHeight;
}

async function handleSend() {
  const input = $c("chatInput");
  const text  = input.value.trim();
  if (!text || chatBusy) return;

  input.value = "";
  chatBusy = true;
  renderChat();

  try {
    await callClaude(text);
  } catch (err) {
    chatHistory.push({
      role: "assistant",
      content: JSON.stringify({
        reply: [{ hanzi: "⚠️", pinyin: "(error)", english: err.message }],
        correction_note: ""
      })
    });
  } finally {
    chatBusy = false;
    renderChat();
  }
}

function openChatSettings() {
  $c("apiKeyInput").value = getApiKey();
  $c("modelSelect").value = chatPrefs.model;
  $c("levelSelect").value = chatPrefs.level;
  $c("chatSettings").classList.add("open");
}
function closeChatSettings() { $c("chatSettings").classList.remove("open"); }

function initChat() {
  loadChatState();

  $c("modelSelect").innerHTML = MODELS.map(m =>
    `<option value="${m.id}">${m.label}</option>`).join("");
  $c("levelSelect").innerHTML = LEVELS.map(l =>
    `<option value="${l}">${l}</option>`).join("");

  $c("chatSettingsBtn").onclick = openChatSettings;
  $c("settingsClose").onclick   = closeChatSettings;
  $c("settingsSave").onclick    = () => {
    setApiKey($c("apiKeyInput").value.trim());
    chatPrefs.model = $c("modelSelect").value;
    chatPrefs.level = $c("levelSelect").value;
    saveChatPrefs();
    closeChatSettings();
    renderChat();
  };
  $c("chatClearBtn").onclick = () => {
    if (chatHistory.length === 0) return;
    if (confirm("Clear the conversation?")) {
      chatHistory = [];
      saveChatHistory();
      renderChat();
    }
  };

  $c("chatSend").onclick = handleSend;
  $c("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  renderChat();
}

initChat();

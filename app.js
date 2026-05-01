/* Tone detection from pinyin marks */
const TONE_MAP = {
  "ā":1,"ē":1,"ī":1,"ō":1,"ū":1,"ǖ":1,
  "á":2,"é":2,"í":2,"ó":2,"ú":2,"ǘ":2,
  "ǎ":3,"ě":3,"ǐ":3,"ǒ":3,"ǔ":3,"ǚ":3,
  "à":4,"è":4,"ì":4,"ò":4,"ù":4,"ǜ":4
};
function toneOf(syllable) {
  for (const ch of syllable) {
    if (TONE_MAP[ch]) return TONE_MAP[ch];
  }
  return 5;
}
function colorizePinyin(pinyin) {
  return pinyin.split(/(\s+)/).map(part => {
    if (/^\s+$/.test(part) || part === "" || part === "…") return part;
    const t = toneOf(part);
    return `<span class="tone-${t}">${part}</span>`;
  }).join("");
}

/* State */
const STORAGE_KEY = "mandarin_learner_v1";
const state = {
  category: "Greetings",
  index: 0,
  revealed: false,
  known: loadKnown(),
  quiz: { correct: 0, wrong: 0, streak: 0, current: null }
};
function loadKnown() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveKnown() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.known));
}
function keyOf(item) { return item.h + "|" + item.e; }

const $ = (id) => document.getElementById(id);
function deck() { return VOCAB[state.category]; }
function curItem() { return deck()[state.index]; }

function showToast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.remove("show"), 1400);
}

/* Speech */
let zhVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  zhVoice = voices.find(v => /zh[-_]CN/i.test(v.lang)) ||
            voices.find(v => /zh/i.test(v.lang)) ||
            voices.find(v => /chinese/i.test(v.name)) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
function speak(text) {
  if (!("speechSynthesis" in window)) {
    showToast("Audio not supported on this browser");
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.85;
  if (zhVoice) u.voice = zhVoice;
  speechSynthesis.speak(u);
}

/* Categories */
function renderCategories() {
  const row = $("categoryRow");
  row.innerHTML = "";
  Object.keys(VOCAB).forEach(cat => {
    const b = document.createElement("button");
    b.className = "chip" + (cat === state.category ? " active" : "");
    b.textContent = cat;
    b.onclick = () => {
      state.category = cat;
      state.index = 0;
      state.revealed = false;
      renderCategories();
      renderLearn();
      renderBrowse();
      nextQuiz();
    };
    row.appendChild(b);
  });
}

function updateStats() {
  const all = Object.values(VOCAB).flat();
  const learned = all.filter(it => state.known[keyOf(it)]).length;
  $("stats").textContent = `${learned} / ${all.length} learned`;
}

/* Flashcards */
function renderLearn() {
  const d = deck();
  const item = curItem();
  $("learnPos").textContent = `Card ${state.index + 1}`;
  $("learnTotal").textContent = `of ${d.length}`;
  $("learnProgress").style.width = `${((state.index + 1) / d.length) * 100}%`;
  $("flHanzi").textContent = item.h;
  if (state.revealed) {
    $("flPinyin").innerHTML = colorizePinyin(item.p);
    $("flEnglish").textContent = item.e;
    $("flHint").textContent = state.known[keyOf(item)] ? "✓ marked as known" : "tap to flip back";
  } else {
    $("flPinyin").textContent = "";
    $("flEnglish").textContent = "";
    $("flHint").textContent = "tap to reveal";
  }
  updateStats();
}

$("flashCard").addEventListener("click", () => {
  state.revealed = !state.revealed;
  renderLearn();
});
$("btnPrev").onclick = (e) => {
  e.stopPropagation();
  state.index = (state.index - 1 + deck().length) % deck().length;
  state.revealed = false;
  renderLearn();
};
$("btnNext").onclick = (e) => {
  e.stopPropagation();
  state.index = (state.index + 1) % deck().length;
  state.revealed = false;
  renderLearn();
};
$("btnSpeak").onclick = (e) => {
  e.stopPropagation();
  speak(curItem().h);
};
$("btnKnown").onclick = (e) => {
  e.stopPropagation();
  const k = keyOf(curItem());
  state.known[k] = !state.known[k];
  saveKnown();
  showToast(state.known[k] ? "Marked as known ✓" : "Unmarked");
  renderLearn();
  renderBrowse();
};

/* Quiz */
function pick(arr, n, exclude) {
  const pool = arr.filter(x => x !== exclude);
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextQuiz() {
  const d = deck();
  if (d.length < 4) {
    $("quizQ").textContent = "Need at least 4 items";
    $("quizOptions").innerHTML = "";
    return;
  }
  const modes = ["h2e", "e2h", "p2e"];
  const mode = modes[Math.floor(Math.random() * modes.length)];
  const correct = d[Math.floor(Math.random() * d.length)];
  const distractors = pick(d, 3, correct);
  const options = shuffle([correct, ...distractors]);
  state.quiz.current = { correct, options, mode };

  const labels = {
    h2e: "Choose the meaning",
    e2h: "Choose the character",
    p2e: "Choose the meaning"
  };
  $("quizLabel").textContent = labels[mode];
  const q = $("quizQ");
  q.classList.remove("small");
  if (mode === "h2e") {
    q.textContent = correct.h;
  } else if (mode === "e2h") {
    q.textContent = correct.e;
    q.classList.add("small");
  } else {
    q.innerHTML = colorizePinyin(correct.p);
    q.classList.add("small");
  }

  const optsEl = $("quizOptions");
  optsEl.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option";
    if (mode === "e2h") {
      btn.innerHTML = `<span style="font-size:24px;margin-right:8px;">${opt.h}</span>
                       <span style="color:var(--muted);font-size:13px;">${colorizePinyin(opt.p)}</span>`;
    } else {
      btn.textContent = opt.e;
    }
    btn.onclick = () => answerQuiz(btn, opt);
    optsEl.appendChild(btn);
  });
  $("quizFeedback").textContent = "";

  if (mode === "h2e" || mode === "p2e") {
    setTimeout(() => speak(correct.h), 300);
  }
}

function answerQuiz(btn, opt) {
  const cur = state.quiz.current;
  document.querySelectorAll(".option").forEach(b => b.classList.add("disabled"));
  if (opt === cur.correct) {
    btn.classList.add("correct");
    state.quiz.correct++;
    state.quiz.streak++;
    $("quizFeedback").textContent = `✓ ${cur.correct.h} — ${cur.correct.p} — ${cur.correct.e}`;
    state.known[keyOf(cur.correct)] = true;
    saveKnown();
  } else {
    btn.classList.add("wrong");
    state.quiz.wrong++;
    state.quiz.streak = 0;
    $("quizFeedback").innerHTML =
      `✗ Correct: <b>${cur.correct.h}</b> — ${colorizePinyin(cur.correct.p)} — ${cur.correct.e}`;
    document.querySelectorAll(".option").forEach(b => {
      if (b.textContent === cur.correct.e || b.innerHTML.includes(cur.correct.h)) {
        b.classList.add("correct");
      }
    });
  }
  $("qCorrect").textContent = state.quiz.correct;
  $("qWrong").textContent = state.quiz.wrong;
  $("qStreak").textContent = state.quiz.streak;
  updateStats();
  setTimeout(nextQuiz, 1500);
}

/* Browse */
function renderBrowse() {
  const list = $("vocabList");
  list.innerHTML = "";
  deck().forEach(item => {
    const row = document.createElement("div");
    row.className = "vocab-row";
    const known = state.known[keyOf(item)] ? " ✓" : "";
    row.innerHTML = `
      <div class="vh">${item.h}</div>
      <div>
        <div class="vp">${colorizePinyin(item.p)}</div>
        <div class="ve">${item.e}${known}</div>
      </div>
      <button class="speaker" aria-label="speak">🔊</button>
    `;
    row.querySelector(".speaker").onclick = (e) => {
      e.stopPropagation();
      speak(item.h);
    };
    row.onclick = () => {
      state.known[keyOf(item)] = !state.known[keyOf(item)];
      saveKnown();
      renderBrowse();
      updateStats();
      showToast(state.known[keyOf(item)] ? "Marked as known ✓" : "Unmarked");
    };
    list.appendChild(row);
  });
}

/* Tabs */
document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.panel;
    $("panel-" + which).classList.add("active");
    document.querySelector(".app").classList.toggle("chat-active", which === "chat");
    if (which === "quiz") nextQuiz();
    if (which === "browse") renderBrowse();
    if (which === "learn") renderLearn();
  };
});

/* Keyboard shortcuts */
document.addEventListener("keydown", (e) => {
  const learnActive = $("panel-learn").classList.contains("active");
  if (!learnActive) return;
  if (e.key === "ArrowLeft") $("btnPrev").click();
  else if (e.key === "ArrowRight") $("btnNext").click();
  else if (e.key === " ") { e.preventDefault(); $("flashCard").click(); }
  else if (e.key.toLowerCase() === "s") $("btnSpeak").click();
});

/* Init */
renderCategories();
renderLearn();
renderBrowse();
updateStats();

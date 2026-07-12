let badgeHost = null;
let currentBadgeEl = null;

function getBadgeHost() {
  if (badgeHost && document.body.contains(badgeHost)) return badgeHost;
  badgeHost = document.createElement("div");
  badgeHost.style.position = "fixed";
  badgeHost.style.top = "0";
  badgeHost.style.left = "0";
  badgeHost.style.zIndex = "2147483647";
  badgeHost.style.pointerEvents = "none";
  const shadow = badgeHost.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .badge {
      position: fixed;
      transform: translateY(-100%);
      display: flex;
      align-items: center;
      gap: 7px;
      font: 500 12.5px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      letter-spacing: 0.1px;
      padding: 7px 12px;
      border-radius: 9px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      white-space: normal;
      max-width: 300px;
    }
    .badge.loading, .badge.listening { background: #141414; color: #f5f5f5; }
    .badge.error { background: #141414; color: #ff8a80; border: 1px solid rgba(255,138,128,0.35); }

    .badge .dots { display: inline-flex; flex: 0 0 auto; gap: 3px; }
    .badge .dots span {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.3;
      animation: texter-pulse 1.1s ease-in-out infinite;
    }
    .badge .dots span:nth-child(2) { animation-delay: 0.15s; }
    .badge .dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes texter-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
      40% { opacity: 1; transform: scale(1); }
    }

    .badge .transcript {
      color: #a8a8a8;
      font-weight: 400;
    }
    .badge .transcript.pulse-in {
      animation: texter-fade-in 0.16s ease-out;
    }
    @keyframes texter-fade-in {
      from { opacity: 0; transform: translateY(2px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  shadow.appendChild(style);
  document.documentElement.appendChild(badgeHost);
  return badgeHost;
}

function buildDots() {
  const dots = document.createElement("span");
  dots.className = "dots";
  for (let i = 0; i < 3; i++) dots.appendChild(document.createElement("span"));
  return dots;
}

function positionBadge(el, rect) {
  el.style.left = `${Math.max(8, rect.left)}px`;
  el.style.top = `${Math.max(8, rect.top - 6)}px`;
}

function showBadge(rect, message, kind) {
  const host = getBadgeHost();
  const shadow = host.shadowRoot;
  hideBadge();
  const el = document.createElement("div");
  el.className = `badge ${kind}`;
  if (kind === "loading") el.appendChild(buildDots());
  const label = document.createElement("span");
  label.textContent = message;
  el.appendChild(label);
  positionBadge(el, rect);
  shadow.appendChild(el);
  currentBadgeEl = el;
  return el;
}

function showListeningBadge(rect, interimText) {
  const host = getBadgeHost();
  const shadow = host.shadowRoot;
  let el = currentBadgeEl && currentBadgeEl.classList.contains("listening") ? currentBadgeEl : null;

  if (!el) {
    hideBadge();
    el = document.createElement("div");
    el.className = "badge listening";
    el.style.pointerEvents = "auto";
    el.style.cursor = "pointer";
    el.title = "Click to stop dictation";
    el.addEventListener("click", stopDictation);
    el.appendChild(buildDots());
    const label = document.createElement("span");
    label.textContent = "Listening";
    const transcript = document.createElement("span");
    transcript.className = "transcript";
    el.appendChild(label);
    el.appendChild(transcript);
    shadow.appendChild(el);
    currentBadgeEl = el;
  }

  positionBadge(el, rect);
  const transcript = el.querySelector(".transcript");
  transcript.textContent = interimText ? `"${interimText}"` : "";
  transcript.classList.remove("pulse-in");
  void transcript.offsetWidth;
  transcript.classList.add("pulse-in");
}

function hideBadge() {
  currentBadgeEl = null;
  if (badgeHost && badgeHost.shadowRoot) {
    badgeHost.shadowRoot.querySelectorAll(".badge").forEach((n) => n.remove());
  }
}

function getEditableTarget() {
  const active = document.activeElement;

  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
    const start = active.selectionStart;
    const end = active.selectionEnd;
    if (typeof start === "number" && typeof end === "number" && start !== end) {
      return {
        type: "field",
        el: active,
        start,
        end,
        text: active.value.substring(start, end)
      };
    }
  }

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const editableRoot = node && node.closest ? node.closest('[contenteditable="true"], [contenteditable=""]') : null;
    if (editableRoot) {
      return {
        type: "contenteditable",
        root: editableRoot,
        range,
        text: selection.toString()
      };
    }
  }

  return null;
}

function getDictationTarget() {
  const active = document.activeElement;

  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
    const pos = active.selectionStart;
    if (typeof pos === "number") {
      return { type: "field", el: active, pos };
    }
  }

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0).cloneRange();
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const editableRoot = node && node.closest ? node.closest('[contenteditable="true"], [contenteditable=""]') : null;
    if (editableRoot) {
      range.collapse(false);
      return { type: "contenteditable", root: editableRoot, range };
    }
  }

  return null;
}

function getSelectionRect(target) {
  if (target.type === "field") {
    return target.el.getBoundingClientRect();
  }
  return target.range.getBoundingClientRect();
}

function replaceText(target, newText) {
  if (target.type === "field") {
    const el = target.el;
    el.focus();
    el.setRangeText(newText, target.start, target.end, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const range = target.range;
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
    const selection = window.getSelection();
    selection.removeAllRanges();
    target.root.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

let dictationState = null;

function needsLeadingSpace(prevChar, chunk) {
  if (!prevChar || /\s/.test(prevChar)) return false;
  return !/^[\s.,!?;:)'"’”]/.test(chunk);
}

function getCharBeforeRange(range) {
  const container = range.startContainer;
  const offset = range.startOffset;
  if (container.nodeType === Node.TEXT_NODE) {
    return offset > 0 ? container.textContent.charAt(offset - 1) : "";
  }
  const prev = container.childNodes[offset - 1];
  return prev && prev.nodeType === Node.TEXT_NODE ? prev.textContent.slice(-1) : "";
}

function insertDictatedChunk(rawChunk) {
  if (!rawChunk) return;
  const state = dictationState;
  if (state.type === "field") {
    const el = state.el;
    el.focus();
    const prevChar = state.pos > 0 ? el.value.charAt(state.pos - 1) : "";
    const chunk = needsLeadingSpace(prevChar, rawChunk) ? ` ${rawChunk}` : rawChunk;
    el.setRangeText(chunk, state.pos, state.pos, "end");
    state.pos = el.selectionStart;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const range = state.range;
    const prevChar = getCharBeforeRange(range);
    const chunk = needsLeadingSpace(prevChar, rawChunk) ? ` ${rawChunk}` : rawChunk;
    const node = document.createTextNode(chunk);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    state.root.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

function onDictationEscape(e) {
  if (e.key === "Escape") stopDictation();
}

function stopDictation() {
  if (!dictationState) return;
  const state = dictationState;
  dictationState = null;
  document.removeEventListener("keydown", onDictationEscape, true);
  try {
    state.recognition.stop();
  } catch (e) {
    // already stopped
  }
  hideBadge();
}

function startDictation() {
  if (dictationState) {
    stopDictation();
    return;
  }

  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionImpl) {
    const rect = { left: 20, top: 60 };
    showBadge(rect, "Voice dictation isn't supported in this browser.", "error");
    setTimeout(hideBadge, 3500);
    return;
  }

  const target = getDictationTarget();
  if (!target) {
    showBadge({ left: 20, top: 60 }, "Click into a text field first.", "error");
    setTimeout(hideBadge, 2500);
    return;
  }

  chrome.storage.local.get(["dictationLang"], ({ dictationLang }) => {
    beginDictation(target, SpeechRecognitionImpl, dictationLang);
  });
}

function beginDictation(target, SpeechRecognitionImpl, dictationLang) {
  const rect = getSelectionRect(target);
  const recognition = new SpeechRecognitionImpl();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = (dictationLang && dictationLang !== "auto") ? dictationLang : (navigator.language || "en-US");

  dictationState = { ...target, recognition };

  recognition.onresult = (event) => {
    if (!dictationState || dictationState.recognition !== recognition) return;
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        insertDictatedChunk(result[0].transcript);
      } else {
        interim += result[0].transcript;
      }
    }
    showListeningBadge(getSelectionRect(dictationState), interim);
  };

  recognition.onerror = (event) => {
    if (!dictationState || dictationState.recognition !== recognition) return;
    stopDictation();
    const messages = {
      "not-allowed": "Microphone permission denied.",
      "no-speech": "No speech detected."
    };
    showBadge(rect, messages[event.error] || "Voice dictation error.", "error");
    setTimeout(hideBadge, 3000);
  };

  recognition.onend = () => {
    if (dictationState && dictationState.recognition === recognition) {
      dictationState = null;
      document.removeEventListener("keydown", onDictationEscape, true);
      hideBadge();
    }
  };

  document.addEventListener("keydown", onDictationEscape, true);
  showListeningBadge(rect, "");
  recognition.start();
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "dictate-toggle") {
    startDictation();
    return;
  }
  if (request.action !== "refine") return;

  const target = getEditableTarget();
  if (!target || !target.text.trim()) {
    const rect = window.getSelection().rangeCount
      ? window.getSelection().getRangeAt(0).getBoundingClientRect()
      : { left: 20, top: 60 };
    showBadge(rect, "Select text in an editable field first.", "error");
    setTimeout(hideBadge, 2500);
    return;
  }

  const rect = getSelectionRect(target);
  showBadge(rect, "Refining…", "loading");

  chrome.runtime.sendMessage(
    { action: "callLLM", text: target.text, style: request.style },
    (response) => {
      hideBadge();
      if (!response || !response.ok) {
        const message = response?.error || "Something went wrong.";
        showBadge(rect, message, "error");
        setTimeout(hideBadge, 3500);
        return;
      }
      replaceText(target, response.text);
    }
  );
});

let badgeHost = null;

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
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 5px 10px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      white-space: nowrap;
      max-width: 280px;
      white-space: normal;
    }
    .badge.loading { background: #4f46e5; color: #fff; }
    .badge.error { background: #c62828; color: #fff; }
    .badge.listening { background: #1a7f37; color: #fff; }
  `;
  shadow.appendChild(style);
  document.documentElement.appendChild(badgeHost);
  return badgeHost;
}

function showBadge(rect, message, kind) {
  const host = getBadgeHost();
  const shadow = host.shadowRoot;
  hideBadge();
  const el = document.createElement("div");
  el.className = `badge ${kind}`;
  el.textContent = message;
  el.style.left = `${Math.max(8, rect.left)}px`;
  el.style.top = `${Math.max(8, rect.top - 6)}px`;
  shadow.appendChild(el);
  return el;
}

function hideBadge() {
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

function insertDictatedChunk(chunk) {
  if (!chunk) return;
  const state = dictationState;
  if (state.type === "field") {
    const el = state.el;
    el.focus();
    el.setRangeText(chunk, state.pos, state.pos, "end");
    state.pos = el.selectionStart;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const range = state.range;
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

  const rect = getSelectionRect(target);
  const recognition = new SpeechRecognitionImpl();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  dictationState = { ...target, recognition };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        insertDictatedChunk(result[0].transcript);
      } else {
        interim += result[0].transcript;
      }
    }
    showBadge(getSelectionRect(dictationState), interim ? `Listening… "${interim}"` : "Listening…", "listening");
  };

  recognition.onerror = (event) => {
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
  showBadge(rect, "Listening…", "listening");
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

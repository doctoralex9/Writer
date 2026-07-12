const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const apiKeyHint = document.getElementById("apiKeyHint");
const customStyleInput = document.getElementById("customStyle");
const toggleKeyBtn = document.getElementById("toggleKey");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

const PROVIDER_INFO = {
  openai: {
    label: "OpenAI API Key",
    placeholder: "sk-...",
    hint: 'Stored only on this device. Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com</a>. Requires billing to be set up.'
  },
  gemini: {
    label: "Google Gemini API Key",
    placeholder: "AIza...",
    hint: 'Stored only on this device. Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a>. Free tier availability depends on your country — some regions require adding prepay billing before use.'
  }
};

let storedKeys = { openaiKey: "", geminiKey: "" };

function applyProviderUI(provider) {
  const info = PROVIDER_INFO[provider];
  apiKeyLabel.textContent = info.label;
  apiKeyInput.placeholder = info.placeholder;
  apiKeyHint.innerHTML = info.hint;
  apiKeyInput.value = (provider === "gemini" ? storedKeys.geminiKey : storedKeys.openaiKey) || "";
}

chrome.storage.local.get(["provider", "openaiKey", "geminiKey", "apiKey", "customStyle"], (data) => {
  // "apiKey" is the legacy single-provider field from before Gemini support; treat it as an OpenAI key.
  storedKeys.openaiKey = data.openaiKey || data.apiKey || "";
  storedKeys.geminiKey = data.geminiKey || "";

  const provider = data.provider || "openai";
  providerSelect.value = provider;
  applyProviderUI(provider);

  if (data.customStyle) customStyleInput.value = data.customStyle;
});

providerSelect.addEventListener("change", () => {
  applyProviderUI(providerSelect.value);
});

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleKeyBtn.textContent = isPassword ? "Hide" : "Show";
});

saveBtn.addEventListener("click", () => {
  const provider = providerSelect.value;
  const key = apiKeyInput.value.trim();
  const customStyle = customStyleInput.value.trim();

  if (provider === "gemini") {
    storedKeys.geminiKey = key;
  } else {
    storedKeys.openaiKey = key;
  }

  chrome.storage.local.set(
    {
      provider,
      openaiKey: storedKeys.openaiKey,
      geminiKey: storedKeys.geminiKey,
      customStyle
    },
    () => {
      statusEl.textContent = "Saved.";
      statusEl.className = "ok";
      setTimeout(() => {
        statusEl.textContent = "";
        statusEl.className = "";
      }, 1800);
    }
  );
});

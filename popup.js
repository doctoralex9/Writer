const apiKeyInput = document.getElementById("apiKey");
const customStyleInput = document.getElementById("customStyle");
const dictationLangSelect = document.getElementById("dictationLang");
const toggleKeyBtn = document.getElementById("toggleKey");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["openaiKey", "apiKey", "customStyle", "dictationLang"], (data) => {
  apiKeyInput.value = data.openaiKey || data.apiKey || "";
  if (data.customStyle) customStyleInput.value = data.customStyle;
  dictationLangSelect.value = data.dictationLang || "auto";
});

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleKeyBtn.textContent = isPassword ? "Hide" : "Show";
});

saveBtn.addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();
  const customStyle = customStyleInput.value.trim();
  const dictationLang = dictationLangSelect.value;

  chrome.storage.local.set({ apiKey, customStyle, dictationLang }, () => {
    statusEl.textContent = "Saved.";
    statusEl.className = "ok";
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "";
    }, 1800);
  });
});

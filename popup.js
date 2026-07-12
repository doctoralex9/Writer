const apiKeyInput = document.getElementById("apiKey");
const customStyleInput = document.getElementById("customStyle");
const toggleKeyBtn = document.getElementById("toggleKey");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

chrome.storage.local.get(["openaiKey", "apiKey", "customStyle"], (data) => {
  apiKeyInput.value = data.openaiKey || data.apiKey || "";
  if (data.customStyle) customStyleInput.value = data.customStyle;
});

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleKeyBtn.textContent = isPassword ? "Hide" : "Show";
});

saveBtn.addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();
  const customStyle = customStyleInput.value.trim();

  chrome.storage.local.set({ apiKey, customStyle }, () => {
    statusEl.textContent = "Saved.";
    statusEl.className = "ok";
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "";
    }, 1800);
  });
});

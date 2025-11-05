/* voice-form-controller.js


 

/* ------------------ UI helpers ------------------ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const overlay = $("#voice-overlay");
const srLive = $("#sr-live");
const sttDot = $("#sttDot");
const sttText = $("#sttText");

function showVoice(text, title = "Voice Assistant") {
  overlay.innerHTML = `<div class="title">${title}</div><div class="line">${text}</div>`;
  overlay.style.opacity = 0.95;
  srLive.textContent = text; // SR announcement
  window.clearTimeout(showVoice._t);
  showVoice._t = setTimeout(() => (overlay.style.opacity = 0.6), 3500);
}

/* ------------------ TTS Adapter (replace anytime) ------------------ */
const TTS = {
  enabled: true,
  last: "",
  speak(text) {
    this.last = text;
    showVoice(text);
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  },
  repeat() {
    if (this.last) this.speak(this.last);
  }
};

/* ------------------ STT Demo (replace with your pipeline) ------------------ */
const STT = (() => {
  let rec = null;
  let onResult = null;
  function start(cb) {
    onResult = cb;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      TTS.speak("Speech recognition not available in this browser.");
      return;
    }
    rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[e.results.length - 1][0].transcript.trim();
      sttText.textContent = "listening";
      sttDot.classList.add("on");
      handleVoice(t);
    };
    rec.onend = () => {
      sttText.textContent = "idle";
      sttDot.classList.remove("on");
    };
    rec.start();
    sttText.textContent = "listening";
    sttDot.classList.add("on");
    TTS.speak("Listening. Say 'list fields' to begin.");
  }
  function stop() {
    if (rec) rec.stop();
    sttText.textContent = "idle";
    sttDot.classList.remove("on");
  }
  return { start, stop };
})();

/* Expose a hook so your pipeline can call window.hodaVoice.handle('...') */
window.hodaVoice = {
  handle: (raw) => handleVoice(raw || ""),
  speak: (text) => TTS.speak(text)
};

/* ------------------ Global Field Mapper (Feature #2) ------------------ */
function listAllFields() {
  return $$("input, select, textarea")
    .filter(el => el.type !== "hidden" && !el.disabled && el.offsetParent !== null);
}

function labelFor(el) {
  if (el.id) {
    const l = document.querySelector(`label[for="${el.id}"]`);
    if (l) return l.textContent.trim();
  }
  const parent = el.closest("label");
  if (parent) return parent.textContent.trim();
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  if (el.placeholder) return el.placeholder;
  return el.name || el.id || el.type;
}

function findField(nameLike) {
  if (!nameLike) return null;
  const q = nameLike.toLowerCase();
  const fields = listAllFields();
  // exact matches first (label/name/id)
  let exact = fields.filter(el =>
    labelFor(el).toLowerCase() === q ||
    (el.name || "").toLowerCase() === q ||
    (el.id || "").toLowerCase() === q
  );
  if (exact.length === 1) return exact[0];
  // partial includes
  let partial = fields.filter(el =>
    labelFor(el).toLowerCase().includes(q) ||
    (el.name || "").toLowerCase().includes(q) ||
    (el.id || "").toLowerCase().includes(q)
  );
  if (partial.length >= 1) return partial[0];
  return null;
}

/* ------------------ Actions: fill / select / check / submit ------------------ */
function normalizeDictationValue(v) {
  return v
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s+dash\s+/gi, "-");
}

function fillField(fieldName, value) {
  const el = findField(fieldName);
  if (!el) { TTS.speak("Can't find that field. Say 'list fields' to hear options."); return; }
  value = normalizeDictationValue(value || "");
  if (["SELECT"].includes(el.tagName)) {
    const ok = selectOption(el, value);
    if (!ok) return TTS.speak("Invalid value. Try again.");
    el.focus();
    TTS.speak(`Selected ${el.options[el.selectedIndex]?.text} for ${labelFor(el)}`);
    return;
  }
  if (el.type === "checkbox" || el.type === "radio") {
    TTS.speak(`'${labelFor(el)}' is not a text field. Try 'check' or 'choose'.`);
    return;
  }
  el.value = value;
  el.focus();
  el.dispatchEvent(new Event("input", { bubbles: true }));
  TTS.speak(`Filled ${labelFor(el)}`);
}

function readValue(fieldName) {
  const el = findField(fieldName);
  if (!el) return TTS.speak("Field not found.");
  if (el.tagName === "SELECT") {
    const opt = el.options[el.selectedIndex];
    return TTS.speak(`${labelFor(el)} is ${opt?.text || "not selected"}`);
  }
  if (el.type === "checkbox") return TTS.speak(`${labelFor(el)} is ${el.checked ? "checked" : "not checked"}`);
  if (el.type === "radio") {
    const group = $$(`input[type="radio"][name="${el.name}"]`);
    const chosen = group.find(r => r.checked);
    return TTS.speak(`${el.name} is ${chosen ? chosen.value : "not chosen"}`);
  }
  TTS.speak(`${labelFor(el)} is ${el.value || "empty"}`);
}

function clearField(fieldName) {
  const el = findField(fieldName);
  if (!el) return TTS.speak("Field not found.");
  if (el.tagName === "SELECT") el.selectedIndex = 0;
  else if (el.type === "checkbox") el.checked = false;
  else if (el.type === "radio") $$(`input[type="radio"][name="${el.name}"]`).forEach(r => (r.checked = false));
  else el.value = "";
  el.focus();
  TTS.speak(`Cleared ${labelFor(el)}`);
}

function setCheckbox(fieldName, checked) {
  const el = findField(fieldName);
  if (!el) return TTS.speak("Field not found.");
  if (el.type !== "checkbox") return TTS.speak(`'${labelFor(el)}' is not a checkbox.`);
  el.checked = !!checked;
  el.focus();
  TTS.speak(`${checked ? "Checked" : "Unchecked"} ${labelFor(el)}`);
}

function chooseRadio(valueLike) {
  // choose across visible radios, by value or label text
  const radios = $$("input[type='radio']").filter(r => r.offsetParent !== null);
  if (!radios.length) return TTS.speak("No radio buttons found.");
  const v = valueLike.toLowerCase();
  const match =
    radios.find(r => (r.value || "").toLowerCase() === v) ||
    radios.find(r => (r.closest("label")?.textContent || "").toLowerCase().includes(v));
  if (!match) return TTS.speak("No matching radio option found.");
  match.checked = true;
  match.focus();
  TTS.speak(`Chose ${match.closest("label")?.textContent.trim() || match.value}`);
}

function selectOption(selectEl, token) {
  const opts = [...selectEl.options];
  const num = parseInt(token, 10);
  if (!isNaN(num)) {
    const selectable = opts.filter(o => o.value);
    if (num >= 1 && num <= selectable.length) {
      selectEl.value = selectable[num - 1].value;
      return true;
    }
    return false;
  }
  const exact = opts.find(o => o.text.toLowerCase() === token.toLowerCase());
  const incl = exact || opts.find(o => o.text.toLowerCase().includes(token.toLowerCase()));
  if (incl) { selectEl.value = incl.value; return true; }
  return false;
}

/* ------------- Submit with Auto-Validation Narration (Feature #3) ------------- */
function submitForm() {
  // prefer the form of the currently focused element, else first form
  const active = document.activeElement;
  const form = active && active.form ? active.form : $("form");
  if (!form) return TTS.speak("No form available to submit.");
  if (!form.checkValidity()) {
    const firstInvalid = form.querySelector(":invalid");
    if (firstInvalid) {
      firstInvalid.setAttribute("aria-invalid", "true");
      firstInvalid.focus();
      firstInvalid.reportValidity();
      const msg = validationMsg(firstInvalid);
      TTS.speak(`${msg}. Say 'fill ${labelFor(firstInvalid)} ...' to provide a value.`);
      return;
    }
  }
  form.requestSubmit();
  TTS.speak("Form submitted successfully.");
}

function validationMsg(el) {
  const base = labelFor(el);
  if (el.validity.valueMissing) return `${base} required`;
  if (el.validity.typeMismatch && el.type === "email") return `Email invalid format`;
  if (el.validity.tooShort) return `${base} too short`;
  if (el.validity.patternMismatch) return `${base} invalid format`;
  return el.validationMessage || `${base} invalid`;
}

/* ------------------ Summary & Listing ------------------ */
function listFields() {
  const names = listAllFields().map(labelFor);
  const msg = `Fields: ${names.join(", ")}`;
  TTS.speak(msg);
}

function summary() {
  const parts = [];
  for (const el of listAllFields()) {
    const lab = labelFor(el);
    if (el.tagName === "SELECT") {
      parts.push(`${lab}: ${el.options[el.selectedIndex]?.text || "not selected"}`);
    } else if (el.type === "checkbox") {
      parts.push(`${lab}: ${el.checked ? "checked" : "not checked"}`);
    } else if (el.type === "radio") {
      // radio groups summarized by chosen state later; skip duplicates
      continue;
    } else {
      parts.push(`${lab}: ${el.value || "empty"}`);
    }
  }
  // radio groups
  const groups = [...new Set($$("input[type='radio']").map(r => r.name))];
  for (const g of groups) {
    const chosen = $$(`input[type='radio'][name='${g}']`).find(r => r.checked);
    parts.push(`${g}: ${chosen ? chosen.value : "not chosen"}`);
  }
  TTS.speak("Summary. " + parts.join(". "));
}

/* ------------------ Lightweight Parser ------------------ */
function parseCommand(raw) {
  const t = (raw || "").toLowerCase().trim();
  if (!t) return { intent: "unknown" };
  if (/^(help|\?)$/.test(t)) return { intent: "help" };
  if (/^list (fields|options)$/.test(t)) return { intent: "list_fields" };
  if (/^repeat$/.test(t)) return { intent: "repeat" };
  if (/^summary$/.test(t)) return { intent: "summary" };
  if (/^submit( form)?$/.test(t)) return { intent: "submit" };
  if (/^clear form$/.test(t)) return { intent: "clear_form" };
  if (/^(next field)$/.test(t)) return { intent: "next_field" };
  if (/^(previous field|prev field)$/.test(t)) return { intent: "prev_field" };

  // fill / enter / type
  let m = t.match(/^(fill|enter|type)\s+([\w\s.\-/#]+?)(?:\s+(.*))?$/);
  if (m) return { intent: "fill", field: m[2].trim(), value: (m[3] || "").trim() };
  // focus
  m = t.match(/^focus\s+([\w\s.\-/#]+)$/);
  if (m) return { intent: "focus", field: m[1].trim() };
  // clear [field]
  m = t.match(/^clear\s+([\w\s.\-/#]+)$/);
  if (m) return { intent: "clear_field", field: m[1].trim() };
  // read value
  m = t.match(/^read value\s+([\w\s.\-/#]+)$/);
  if (m) return { intent: "read_value", field: m[1].trim() };
  // select option
  m = t.match(/^select option\s+(.+)$/);
  if (m) return { intent: "select_option", token: m[1].trim() };
  // check/uncheck
  m = t.match(/^(un)?check\s+(.+)$/);
  if (m) return { intent: m[1] ? "uncheck" : "check", field: m[2].trim() };
  // choose radio
  m = t.match(/^choose\s+(.+)$/);
  if (m) return { intent: "choose_radio", value: m[1].trim() };

  // select [dropdown name] (read/show options not implemented in TTS here; we select when combined with value)
  m = t.match(/^select\s+(.+)$/);
  if (m) return { intent: "focus", field: m[1].trim() }; // focus dropdown

  return { intent: "unknown", raw: t };
}

/* ------------------ Command Router ------------------ */
function handleVoice(raw) {
  const cmd = parseCommand(raw);
  console.log("Heard:", raw, "→", cmd);
  switch (cmd.intent) {
    case "help":
      TTS.speak("Try: fill email john at example dot com. Check terms. Select option 2. Choose email. Read value email. Submit form. List fields. Summary.");
      break;
    case "list_fields":
      listFields(); break;
    case "repeat":
      TTS.repeat(); break;
    case "summary":
      summary(); break;
    case "fill":
      if (!cmd.field) return TTS.speak("Say fill followed by a field name and value.");
      fillField(cmd.field, cmd.value || ""); break;
    case "focus": {
      const el = findField(cmd.field);
      if (!el) return TTS.speak("Field not found.");
      el.focus();
      TTS.speak(`Focused ${labelFor(el)}`);
      break;
    }
    case "clear_field":
      clearField(cmd.field); break;
    case "read_value":
      readValue(cmd.field); break;
    case "select_option": {
      const el = document.activeElement?.tagName === "SELECT" ? document.activeElement : $("select");
      if (!el) return TTS.speak("No dropdown focused. Say focus followed by a dropdown name.");
      const ok = selectOption(el, cmd.token);
      TTS.speak(ok ? `Option selected` : `Invalid value. Try again.`);
      break;
    }
    case "check":
      setCheckbox(cmd.field, true); break;
    case "uncheck":
      setCheckbox(cmd.field, false); break;
    case "choose_radio":
      chooseRadio(cmd.value); break;
    case "submit":
      submitForm(); break;
    case "clear_form":
      const form = document.activeElement?.form || $("form");
      if (!form) return TTS.speak("No form focused.");
      form.reset();
      TTS.speak("Form cleared.");
      break;
    case "next_field": {
      const fields = listAllFields();
      const idx = Math.max(0, fields.indexOf(document.activeElement));
      const next = fields[(idx + 1) % fields.length];
      next?.focus();
      TTS.speak(`Focused ${labelFor(next)}`);
      break;
    }
    case "prev_field": {
      const fields = listAllFields();
      const idx = Math.max(0, fields.indexOf(document.activeElement));
      const prev = fields[(idx - 1 + fields.length) % fields.length];
      prev?.focus();
      TTS.speak(`Focused ${labelFor(prev)}`);
      break;
    }
    default:
      TTS.speak("Sorry, I didn't get that. Say 'help' for examples.");
  }
}

/* ------------------ Wire up buttons & form feedback ------------------ */
$("#btnStart").addEventListener("click", () => STT.start(handleVoice));
$("#btnStop").addEventListener("click", () => STT.stop());
$("#btnRun").addEventListener("click", () => handleVoice($("#txtCmd").value));
$("#btnHelp").addEventListener("click", () => handleVoice("help"));
$("#btnList").addEventListener("click", () => handleVoice("list fields"));

/* On submit of each form, show success/error (and narrate) */
["login", "signup", "contact", "checkout"].forEach(formType => {
  const form = document.getElementById(`${formType}-form`);
  const successDiv = document.getElementById(`${formType}-success`);
  const errorDiv = document.getElementById(`${formType}-error`);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    successDiv.style.display = "none";
    errorDiv.style.display = "none";
    if (form.checkValidity()) {
      successDiv.style.display = "block";
      TTS.speak(`${formType} form submitted successfully.`);
      setTimeout(() => { form.reset(); successDiv.style.display = "none"; }, 2000);
    } else {
      errorDiv.style.display = "block";
      const firstInvalid = form.querySelector(":invalid");
      if (firstInvalid) {
        firstInvalid.setAttribute("aria-invalid", "true");
        firstInvalid.focus();
        firstInvalid.reportValidity();
        TTS.speak(validationMsg(firstInvalid));
      }
    }
  });
  form.addEventListener("reset", () => {
    successDiv.style.display = "none";
    errorDiv.style.display = "none";
    $$("[aria-invalid='true']", form).forEach(el => el.removeAttribute("aria-invalid"));
  });
});

/* Announce detected fields at load */
window.addEventListener("DOMContentLoaded", () => {
  const names = listAllFields().map(labelFor).join(", ");
  showVoice(`Detected fields: ${names}`, "Voice Assistant");
});

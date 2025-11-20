
document.addEventListener('DOMContentLoaded', () => {
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

  const overlay=$("#voice-overlay");
  const srLive=$("#sr-live");
  const sttDot=$("#sttDot");
  const sttText=$("#sttText");
  const cmdBox=$("#txtCmd");

  function speakOverlay(text,title="Voice Assistant"){
    if (!overlay) return;
    overlay.innerHTML = `<div class="title">${title}</div><div class="line">${text}</div>`;
    if (srLive) srLive.textContent = text;
  }

  function formFields(){
    return [...document.querySelectorAll("form input, form select, form textarea")]
      .filter(el => el.type!=="hidden" && !el.disabled && el.offsetParent!==null);
  }

  function labelOf(el){
    if (!el) return "";
    if (el.id){
      const l=document.querySelector(`label[for="${el.id}"]`);
      if (l) return l.textContent.trim();
    }
    const parent=el.closest("label");
    if (parent) return parent.textContent.trim();
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.placeholder) return el.placeholder;
    return el.name || el.id || el.type || "field";
  }

  const STT = (() => {
    let rec=null, active=false;
    function create(){
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if (!SR) return null;
      const r=new SR();
      r.lang="en-US";
      r.continuous=true;
      r.interimResults=false;
      r.onresult = e => {
        const t=e.results[e.results.length-1][0].transcript.trim();
        handleCommand(t);
      };
      r.onend = () => {
        active=false;
        if (sttText) sttText.textContent="idle";
        if (sttDot) sttDot.classList.remove("on");
      };
      return r;
    }
    function start(){
      stop();
      try { document.activeElement && document.activeElement.blur?.(); } catch {}
      rec=create();
      if (!rec){
        TTS.speak("Speech recognition is not available in this browser.");
        return;
      }
      rec.start();
      active=true;
      if (sttText) sttText.textContent="listening";
      if (sttDot) sttDot.classList.add("on");
      TTS.speak("Listening. Say list fields to begin.");
    }
    function stop(){
      try { rec && rec.stop(); } catch {}
      rec=null;
      active=false;
      if (sttText) sttText.textContent="idle";
      if (sttDot) sttDot.classList.remove("on");
    }
    return { start, stop, isActive:()=>active };
  })();

  const TTS = {
    last:"",
    speaking:false,
    resume:false,
    speak(text){
      this.last=text;
      this.speaking=true;
      speakOverlay(text);
      if (STT.isActive()){
        STT.stop();
        this.resume=true;
      }
      if (!("speechSynthesis" in window)){
        this.speaking=false;
        if (this.resume){ this.resume=false; STT.start(); }
        return;
      }
      const u=new SpeechSynthesisUtterance(text);
      u.onend=()=>{
        this.speaking=false;
        if (this.resume){ this.resume=false; STT.start(); }
      };
      window.speechSynthesis.speak(u);
    },
    repeat(){
      if (this.last) this.speak(this.last);
    }
  };

  const STOP_WORDS=new Set(["the","a","an","to","for","with","as","my","is","of","on","in","at","your","this","that"]);
  const ALIAS={
    email:["mail","e-mail","username","login email","login"],
    name:["full name","fullname","first name","last name"],
    password:["pass","passcode","pwd","pass word"],
    city:["town"],
    zip:["zipcode","postal","postcode","pin"],
    country:["nation","residence","country name"],
    address:["street","street address","addr","house address"],
    card:["card number","credit card","debit card","cc number"],
    subject:["topic","reason","issue"],
    message:["comment","note","feedback","details"],
    terms:["agreement","policy","terms and conditions"],
    subscribe:["newsletter","emails","updates","marketing"],
    remember:["remember me","keep me signed in"]
  };

  const tokenize = s =>
    (s||"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w && !STOP_WORDS.has(w));

  const expandToken = t => {
    const out=[t];
    for (const [k,arr] of Object.entries(ALIAS)){
      if (t===k || arr.includes(t)) out.push(k);
    }
    return out;
  };

  function indexField(el){
    const text=[labelOf(el), el.name||"", el.id||"", el.placeholder||"", el.type||""].join(" ");
    const tokens=new Set();
    tokenize(text).forEach(w=>expandToken(w).forEach(x=>tokens.add(x)));
    return { el, tokens, label: labelOf(el).toLowerCase() };
  }

  let FIELD_INDEX = formFields().map(indexField);

  function findField(query){
    if (!query) return null;
    const qTokens = tokenize(query).flatMap(expandToken);
    if (!qTokens.length) return null;

    const activeForm = document.activeElement && document.activeElement.form ? document.activeElement.form : null;

    let best=null, bestScore=0;
    for (const item of FIELD_INDEX){
      const el=item.el;
      if (!el || el.type==="hidden" || el.disabled || el.offsetParent===null) continue;
      let score = (activeForm && el.form === activeForm) ? 2 : 0;
      for (const qt of qTokens) if (item.tokens.has(qt)) score++;
      if (item.label.includes(query.toLowerCase())) score += 0.5;
      if (score>bestScore){
        best=el;
        bestScore=score;
      }
    }
    return bestScore>0 ? best : null;
  }

  const normalizeValue = v => (v||"")
    .replace(/\s+at\s+/gi,"@")
    .replace(/\s+dot\s+/gi,".")
    .replace(/\s+dash\s+/gi,"-")
    .replace(/\s+underscore\s+/gi,"_")
    .replace(/\s+plus\s+/gi,"+");

  function selectOption(sel, token){
    const opts=[...sel.options];
    const n=parseInt(token,10);
    if (!isNaN(n)){
      const usable=opts.filter(o=>o.value);
      if (n>=1 && n<=usable.length){
        sel.value=usable[n-1].value;
        return true;
      }
      return false;
    }
    const t=token.toLowerCase();
    const exact=opts.find(o=>o.text.toLowerCase()===t);
    const incl = exact || opts.find(o=>o.text.toLowerCase().includes(t));
    if (incl){
      sel.value=incl.value;
      return true;
    }
    return false;
  }

  function fillField(field,value){
    const el=findField(field);
    if (!el){
      TTS.speak("Can't find that field. Say list fields to hear options.");
      return;
    }
    const v=normalizeValue(value);
    if (el.tagName==="SELECT"){
      const ok=selectOption(el,v);
      if (!ok){
        TTS.speak("Invalid value. Try again.");
        return;
      }
      el.focus();
      TTS.speak(`Selected ${el.options[el.selectedIndex]?.text} for ${labelOf(el)}`);
      return;
    }
    if (el.type==="checkbox" || el.type==="radio"){
      TTS.speak(`'${labelOf(el)}' is not a text field. Try check or choose.`);
      return;
    }
    el.value=v;
    el.focus();
    el.dispatchEvent(new Event("input",{bubbles:true}));
    TTS.speak(`Filled ${labelOf(el)}`);
  }

  function readField(field){
    const el=findField(field);
    if (!el){
      TTS.speak("Field not found.");
      return;
    }
    if (el.tagName==="SELECT"){
      const op=el.options[el.selectedIndex];
      TTS.speak(`${labelOf(el)} is ${op?.text || "not selected"}`);
      return;
    }
    if (el.type==="checkbox"){
      TTS.speak(`${labelOf(el)} is ${el.checked?"checked":"not checked"}`);
      return;
    }
    if (el.type==="radio"){
      const group=$$(`input[type="radio"][name="${el.name}"]`).find(r=>r.checked);
      TTS.speak(`${el.name} is ${group?group.value:"not chosen"}`);
      return;
    }
    TTS.speak(`${labelOf(el)} is ${el.value || "empty"}`);
  }

  function clearField(field){
    const el=findField(field);
    if (!el){
      TTS.speak("Field not found.");
      return;
    }
    if (el.tagName==="SELECT") el.selectedIndex=0;
    else if (el.type==="checkbox") el.checked=false;
    else if (el.type==="radio") $$(`input[type="radio"][name="${el.name}"]`).forEach(r=>r.checked=false);
    else el.value="";
    el.focus();
    TTS.speak(`Cleared ${labelOf(el)}`);
  }

  function setCheckbox(field, val){
    const el=findField(field);
    if (!el){
      TTS.speak("Field not found.");
      return;
    }
    if (el.type!=="checkbox"){
      TTS.speak(`'${labelOf(el)}' is not a checkbox.`);
      return;
    }
    el.checked=!!val;
    el.focus();
    TTS.speak(`${val?"Checked":"Unchecked"} ${labelOf(el)}`);
  }

  function validationMsg(el){
    const base=labelOf(el);
    if (el.validity.valueMissing) return `${base} required`;
    if (el.validity.typeMismatch && el.type==="email") return "Email invalid format";
    if (el.validity.tooShort) return `${base} too short`;
    if (el.validity.patternMismatch) return `${base} invalid format`;
    return el.validationMessage || `${base} invalid`;
  }

  function submitCurrentForm(){
    const form = document.activeElement?.form || document.querySelector("form");
    if (!form){
      TTS.speak("No form available to submit.");
      return;
    }
    if (!form.checkValidity()){
      const bad=form.querySelector(":invalid");
      if (bad){
        bad.focus();
        bad.reportValidity();
        TTS.speak(`${validationMsg(bad)}. Say set ${labelOf(bad)} to followed by a value.`);
        return;
      }
    }
    form.requestSubmit();
    TTS.speak("Form submitted successfully.");
  }

  function listFields(){
    const names=formFields().map(labelOf);
    TTS.speak("Fields: " + (names.join(", ") || "none"));
  }

  function summary(){
    const parts=[];
    for (const el of formFields()){
      const L=labelOf(el);
      if (el.tagName==="SELECT"){
        parts.push(`${L}: ${el.options[el.selectedIndex]?.text || "not selected"}`);
      } else if (el.type==="checkbox"){
        parts.push(`${L}: ${el.checked?"checked":"not checked"}`);
      } else if (el.type!=="radio"){
        parts.push(`${L}: ${el.value || "empty"}`);
      }
    }
    const groups=[...new Set($$("input[type='radio']").map(r=>r.name))];
    for (const g of groups){
      const chosen=$$(`input[type="radio"][name="${g}"]`).find(r=>r.checked);
      parts.push(`${g}: ${chosen?chosen.value:"not chosen"}`);
    }
    TTS.speak("Summary. " + (parts.join(". ") || "No inputs yet."));
  }

  function parseCommand(raw){
    const t=(raw||"").toLowerCase().trim();
    if (!t) return {intent:"unknown"};

    if (/^(help|\?)$/.test(t)) return {intent:"help"};
    if (/^(list|show)\s+(fields|options)$/.test(t)) return {intent:"list_fields"};
    if (/^repeat$/.test(t)) return {intent:"repeat"};
    if (/^(summary|review form|read all|tell me my inputs)$/.test(t)) return {intent:"summary"};
    if (/^(submit|send|finish)(\s+form)?$/.test(t)) return {intent:"submit"};
    if (/^(clear|reset|restart|start over)\s+form$/.test(t)) return {intent:"clear_form"};
    if (/^(next|jump to next)\s+field$/.test(t)) return {intent:"next_field"};
    if (/^(previous|prev|back)\s+field$/.test(t)) return {intent:"prev_field"};

    let m=t.match(/^(?:fill|enter|type|set|write|input|put|update)\s+(?:the\s+)?([\w\s.\-/#]+?)(?:\s+(?:to|as|with)\s+)?(.+)?$/);
    if (m && m[1]) return {intent:"fill", field:m[1].trim(), value:(m[2]||"").trim()};

    m=t.match(/^(?:my\s+)?([\w\s.\-/#]+?)\s+(?:is|=)\s+(.+)$/);
    if (m) return {intent:"fill", field:m[1].trim(), value:m[2].trim()};

    m=t.match(/^(name|email|password|city|zip|country|address|age|card|subject|message)\s+(.+)$/);
    if (m) return {intent:"fill", field:m[1].trim(), value:m[2].trim()};

    m=t.match(/^(?:focus|go to|move to|highlight|select)\s+(?:the\s+)?([\w\s.\-/#]+)$/);
    if (m) return {intent:"focus", field:m[1].trim()};

    m=t.match(/^(?:read|show|what(?:'s| is) in)\s+(?:the\s+)?([\w\s.\-/#]+)$/);
    if (m) return {intent:"read", field:m[1].trim()};

    m=t.match(/^(?:clear|reset|erase|empty)\s+(?:the\s+)?([\w\s.\-/#]+)$/);
    if (m) return {intent:"clear_field", field:m[1].trim()};

    m=t.match(/^(?:select|choose|pick|set)\s+(?:option\s+)?(.+?)(?:\s+(?:in|on|for)\s+([\w\s.\-/#]+))?$/);
    if (m) return {intent:"select_option", token:(m[1]||"").trim(), field:(m[2]||"").trim()||null};

    m=t.match(/^(?:check|tick|enable|mark)\s+(.+)$/);
    if (m) return {intent:"check", field:m[1].trim()};

    m=t.match(/^(?:uncheck|untick|disable|unmark)\s+(.+)$/);
    if (m) return {intent:"uncheck", field:m[1].trim()};

    return {intent:"unknown", raw:t};
  }

  function handleCommand(raw){
    if (cmdBox){ cmdBox.value=""; cmdBox.blur(); }
    try { document.activeElement && document.activeElement.blur?.(); } catch {}

    const heard=(raw||"").trim();
    if (TTS.speaking) return;
    if (heard && TTS.last && heard.toLowerCase()===TTS.last.toLowerCase()) return;

    const cmd=parseCommand(heard);
    speakOverlay(`Heard: "${heard}"\n→ intent: ${cmd.intent}${cmd.field?`, field: ${cmd.field}`:""}${cmd.value?`, value: ${cmd.value}`:""}${cmd.token?`, token: ${cmd.token}`:""}`);

    switch (cmd.intent){
      case "help":
        TTS.speak("Try: email john at example dot com. password secret one two three. check terms. select option 2 in country. submit form. summary.");
        break;
      case "list_fields":
        FIELD_INDEX=formFields().map(indexField);
        listFields();
        break;
      case "repeat":
        TTS.repeat();
        break;
      case "summary":
        summary();
        break;
      case "fill":
        if (!cmd.field || !cmd.value){
          TTS.speak("Say set field to value, for example set email to john at example dot com.");
          break;
        }
        fillField(cmd.field, cmd.value);
        break;
      case "focus": {
        const el=findField(cmd.field);
        if (!el){
          TTS.speak("Field not found.");
          break;
        }
        el.focus();
        TTS.speak(`Focused ${labelOf(el)}`);
        break;
      }
      case "clear_field":
        clearField(cmd.field);
        break;
      case "read":
        readField(cmd.field);
        break;
      case "select_option": {
        let sel=null;
        if (cmd.field){
          const target=findField(cmd.field);
          if (target && target.tagName==="SELECT") sel=target;
        }
        if (!sel) sel = document.activeElement?.tagName==="SELECT" ? document.activeElement : document.querySelector("select");
        if (!sel){
          TTS.speak("No dropdown found. Say focus followed by a dropdown name.");
          break;
        }
        const ok=selectOption(sel, cmd.token || "");
        TTS.speak(ok ? "Option selected." : "Invalid value. Try again.");
        break;
      }
      case "check":
        setCheckbox(cmd.field,true);
        break;
      case "uncheck":
        setCheckbox(cmd.field,false);
        break;
      case "submit":
        submitCurrentForm();
        break;
      case "clear_form": {
        const form = document.activeElement?.form || document.querySelector("form");
        if (!form){
          TTS.speak("No form to clear.");
          break;
        }
        form.reset();
        FIELD_INDEX=formFields().map(indexField);
        TTS.speak("Form cleared.");
        break;
      }
      case "next_field": {
        const fields=formFields();
        if (!fields.length) { TTS.speak("No fields available."); break; }
        const idx=Math.max(0, fields.indexOf(document.activeElement));
        const next=fields[(idx+1)%fields.length];
        next.focus();
        TTS.speak(`Focused ${labelOf(next)}`);
        break;
      }
      case "prev_field": {
        const fields=formFields();
        if (!fields.length) { TTS.speak("No fields available."); break; }
        const idx=Math.max(0, fields.indexOf(document.activeElement));
        const prev=fields[(idx-1+fields.length)%fields.length];
        prev.focus();
        TTS.speak(`Focused ${labelOf(prev)}`);
        break;
      }
      default:
        TTS.speak("Sorry, I didn't understand. Say help for examples.");
    }
  }

  $("#btnStart")?.addEventListener("click", () => STT.start(handleCommand));
  $("#btnStop") ?.addEventListener("click", () => STT.stop());
  $("#btnRun")  ?.addEventListener("click", () => handleCommand(cmdBox?.value || ""));
  $("#btnHelp") ?.addEventListener("click", () => handleCommand("help"));
  $("#btnList") ?.addEventListener("click", () => handleCommand("list fields"));

  ["login","signup","contact","checkout"].forEach(type=>{
    const form=$("#"+type+"-form");
    if (!form) return;
    const ok=$("#"+type+"-success");
    const err=$("#"+type+"-error");

    form.addEventListener("submit", e=>{
      e.preventDefault();
      if (ok) ok.style.display="none";
      if (err) err.style.display="none";
      if (form.checkValidity()){
        if (ok) ok.style.display="block";
        TTS.speak(`${type} form submitted successfully.`);
        setTimeout(()=>{
          form.reset();
          if (ok) ok.style.display="none";
          FIELD_INDEX=formFields().map(indexField);
        },1500);
      } else {
        if (err) err.style.display="block";
        const bad=form.querySelector(":invalid");
        if (bad){
          bad.focus();
          bad.reportValidity();
          TTS.speak(validationMsg(bad));
        }
      }
    });

    form.addEventListener("reset", ()=>{
      if (ok) ok.style.display="none";
      if (err) err.style.display="none";
      FIELD_INDEX=formFields().map(indexField);
    });
  });

  FIELD_INDEX=formFields().map(indexField);
  speakOverlay("Ready. Try: email john at example dot com, password secret one two three, check terms, submit form.");
});


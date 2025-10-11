// extension/src/content.js
// Plain JS content script: STT + command parsing + page actions
(function () {
  /* ----------------- feedback ----------------- */
  function playBeep(duration = 100, freq = 880, volume = 0.02) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = volume;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(function () { try { o.stop(); ctx.close(); } catch (e) {} }, duration);
    } catch (e) {
      // ignore
    }
  }

  /* ----------------- commands interpreter ----------------- */
  function wordsToNumber(s) {
    if (!s) return null;
    s = String(s).toLowerCase().replace(/-/g, ' ').trim();
    if (/^\d+$/.test(s)) return Number(s);
    var small = {
      zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
      ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16,
      seventeen:17, eighteen:18, nineteen:19
    };
    var tens = {
      twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90
    };
    var parts = s.split(/\s+/);
    var total = 0;
    var current = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === 'and') continue;
      if (small[p] !== undefined) current += small[p];
      else if (tens[p] !== undefined) current += tens[p];
      else if (p === 'hundred') current = current === 0 ? 100 : current * 100;
      else if (p === 'thousand') { current = current === 0 ? 1000 : current * 1000; total += current; current = 0; }
      else if (/^\d+$/.test(p)) current += Number(p);
      else { /* ignore unknown token */ }
    }
    total += current;
    return Number.isFinite(total) ? total : null;
  }

  function interpretTranscript(text) {
    var cleaned = (text || '').toLowerCase().trim();

    // numeric "open link 3"
    var m = cleaned.match(/\bopen (?:link|the link)\s+([0-9]+)\b/);
    if (m) return { cmd: 'open link', arg: Number(m[1]), raw: cleaned };

    // "open link three"
    m = cleaned.match(/\bopen (?:link|the link)\s+([a-z\s-]+)\b/);
    if (m) {
      var num = wordsToNumber(m[1].trim());
      if (num !== null && num !== 0) return { cmd: 'open link', arg: num, raw: cleaned };
    }

    if (/\b(go down|scroll down|scroll|down)\b/.test(cleaned)) return { cmd: 'scroll down', raw: cleaned };
    if (/\b(go up|scroll up|up)\b/.test(cleaned)) return { cmd: 'scroll up', raw: cleaned };
    if (/\b(go back|back)\b/.test(cleaned)) return { cmd: 'go back', raw: cleaned };
    if (/\b(read (the )?page|start reading|read this)\b/.test(cleaned)) return { cmd: 'read page', raw: cleaned };
    if (/\b(stop reading|stop|cancel)\b/.test(cleaned)) return { cmd: 'stop reading', raw: cleaned };
    if (/\b(pause)\b/.test(cleaned)) return { cmd: 'pause', raw: cleaned };
    if (/\b(resume)\b/.test(cleaned)) return { cmd: 'resume', raw: cleaned };
    if (/\b(list links|links|list)\b/.test(cleaned)) return { cmd: 'list links', raw: cleaned };
    if (/\b(help|what can i say|what can you do)\b/.test(cleaned)) return { cmd: 'help', raw: cleaned };
    if (/\b(repeat)\b/.test(cleaned)) return { cmd: 'repeat', raw: cleaned };
    if (/\b(zoom in|bigger|increase zoom)\b/.test(cleaned)) return { cmd: 'zoom in', raw: cleaned };
    if (/\b(zoom out|smaller|decrease zoom)\b/.test(cleaned)) return { cmd: 'zoom out', raw: cleaned };
    if (/\b(reset zoom|default zoom)\b/.test(cleaned)) return { cmd: 'reset zoom', raw: cleaned };

    // "open link google" or similar -> text match
    m = cleaned.match(/\bopen (?:link )?(.{1,60})$/);
    if (m && m[1]) {
      var candidate = m[1].trim();
      if (!/^\d+$/.test(candidate)) return { cmd: 'open link', text: candidate, raw: cleaned };
    }

    return { cmd: 'unknown', raw: cleaned };
  }

  /* ----------------- ContentSTT ----------------- */
  function ContentSTT(options) {
    options = options || {};
    this.lang = options.lang || 'en-US';
    this.wakeWord = (options.wakeWord === undefined) ? null : options.wakeWord;
    this.onTranscript = options.onTranscript || function () {};
    this.onCommand = options.onCommand || function () {};
    this.minConfidence = options.minConfidence || 0;

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('SpeechRecognition not available in this runtime');
      this._available = false;
      return;
    }

    this.rec = new SR();
    this.rec.continuous = true;
    this.rec.interimResults = true;
    this.rec.lang = this.lang;

    var self = this;
    this.rec.onresult = function (ev) { self._handleResult(ev); };
    this.rec.onerror = function (ev) { self._handleError(ev); };
    this.rec.onend = function () { self._handleEnd(); };

    this._available = true;
    this._shouldRestart = false;
    this._listening = false;
    this._recentFinals = [];
    this._awaitingCommand = false;
    this._awaitTimeout = null;
  }

  ContentSTT.prototype.available = function () { return !!this._available; };
  Object.defineProperty(ContentSTT.prototype, 'listening', {
    get: function () { return !!this._listening; }
  });

  ContentSTT.prototype.start = function () {
    if (!this._available) throw new Error('SpeechRecognition unavailable');
    this._shouldRestart = true;
    try { this.rec.start(); } catch (e) {}
    this._listening = true;
  };

  ContentSTT.prototype.stop = function () {
    this._shouldRestart = false;
    try { this.rec.stop(); } catch (e) {}
    this._listening = false;
    clearTimeout(this._awaitTimeout);
    this._awaitingCommand = false;
  };

  ContentSTT.prototype._handleResult = function (ev) {
    var interim = '';
    var final = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      var r = ev.results[i][0];
      if (ev.results[i].isFinal) final += r.transcript;
      else interim += r.transcript;
    }
    var transcript = (final ? final : interim).trim();
    var isFinal = !!final;
    try { this.onTranscript({ transcript: transcript, isFinal: isFinal, raw: ev }); } catch (e) {}

    if (!isFinal) return;

    var cleaned = final.trim();
    if (this._recentFinals.length && this._recentFinals[this._recentFinals.length - 1] === cleaned) {
      return;
    }
    this._recentFinals.push(cleaned);
    if (this._recentFinals.length > 6) this._recentFinals.shift();

    if (this.wakeWord) {
      if (cleaned.toLowerCase().indexOf(this.wakeWord.toLowerCase()) !== -1) {
        playBeep();
        this._awaitingCommand = true;
        var self = this;
        clearTimeout(this._awaitTimeout);
        this._awaitTimeout = setTimeout(function () { self._awaitingCommand = false; }, 6000);
        return;
      } else if (this._awaitingCommand) {
        this._awaitingCommand = false;
        this._processFinal(cleaned);
        return;
      } else {
        return;
      }
    } else {
      this._processFinal(cleaned);
    }
  };

  ContentSTT.prototype._processFinal = function (finalText) {
    var interpreted = interpretTranscript(finalText);
    try {
      this.onCommand({
        cmd: interpreted.cmd,
        arg: interpreted.arg,
        text: interpreted.text,
        rawTranscript: finalText,
        meta: interpreted
      });
    } catch (e) {}
    playBeep(90, 880, 0.02);
  };

  ContentSTT.prototype._handleError = function (ev) {
    console.warn('STT error', ev);
    if (this._shouldRestart) {
      var self = this;
      setTimeout(function () { try { self.rec.start(); } catch (e) {} }, 500);
    }
  };

  ContentSTT.prototype._handleEnd = function () {
    this._listening = false;
    if (this._shouldRestart) {
      var self = this;
      setTimeout(function () { try { self.rec.start(); self._listening = true; } catch (e) {} }, 300);
    }
  };

  /* ----------------- UI + command handling ----------------- */
  var stt = null;

  function ensureSTT() {
    if (stt) return stt;
    stt = new ContentSTT({
      lang: 'en-US',
      wakeWord: null, // set to 'hey hoda' if desired
      onTranscript: function (ev) {
        showOverlay(ev.transcript, ev.isFinal ? 2500 : 800);
      },
      onCommand: function (c) { handleCommand(c); }
    });
    return stt;
  }

  function showOverlay(text, ms) {
    ms = ms === undefined ? 2000 : ms;
    var el = document.getElementById('hoda-stt-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hoda-stt-overlay';
      Object.assign(el.style, {
        position: 'fixed', right: '12px', bottom: '12px', zIndex: 2147483647,
        padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.75)',
        color: 'white', fontFamily: 'Segoe UI, Roboto, sans-serif', fontSize: '13px'
      });
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, ms);
  }

  function handleCommand(evt) {
    var cmd = evt.cmd;
    var arg = evt.arg;
    var text = evt.text;
    switch (cmd) {
      case 'scroll down':
        window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
        chrome.runtime.sendMessage({ cmd: 'confirm', text: 'Scrolling down' });
        break;
      case 'scroll up':
        window.scrollBy({ top: -window.innerHeight * 0.9, behavior: 'smooth' });
        chrome.runtime.sendMessage({ cmd: 'confirm', text: 'Scrolling up' });
        break;
      case 'go back':
        history.back();
        chrome.runtime.sendMessage({ cmd: 'confirm', text: 'Going back' });
        break;
      case 'list links':
        (function () {
          var anchors = Array.from(document.querySelectorAll('a')).filter(function (a) { return (a.href && a.offsetParent !== null); }).slice(0, 10);
          var lines = anchors.map(function (a, i) {
            var txt = a.textContent || a.getAttribute('aria-label') || a.href;
            return (i + 1) + '. ' + (txt && txt.slice ? txt.slice(0, 60) : String(txt));
          });
          showOverlay(lines.join(' • '), 6000);
          chrome.runtime.sendMessage({ cmd: 'confirm', text: 'Links listed' });
        }());
        break;
      case 'open link':
        (function () {
          if (arg && Number.isFinite(arg)) {
            var anchors = Array.from(document.querySelectorAll('a')).filter(function (a) { return (a.href && a.offsetParent !== null); });
            var target = anchors[arg - 1];
            if (target) { target.click(); chrome.runtime.sendMessage({ cmd: 'confirm', text: 'Opening link' }); }
            else chrome.runtime.sendMessage({ cmd: 'confirm', text: 'Link not found' });
          } else if (text) {
            var t = text.toLowerCase();
            var anchors2 = Array.from(document.querySelectorAll('a')).filter(function (a) { return (a.href && a.offsetParent !== null); });
            var match = anchors2.find(function (a) {
              var hay = (a.textContent || a.getAttribute('aria-label') || '').toLowerCase();
              return hay.indexOf(t) !== -1;
            });
            if (match) { match.click(); chrome.runtime.sendMessage({ cmd: 'confirm', text: 'Opening link' }); }
            else chrome.runtime.sendMessage({ cmd: 'confirm', text: 'No matching link' });
          }
        }());
        break;
      default:
        chrome.runtime.sendMessage({ cmd: 'confirm', text: "I didn't understand" });
        break;
    }
  }

  /* ----------------- message listener ----------------- */
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === 'START_STT') {
      try {
        ensureSTT().start();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, err: e && e.message });
      }
      return true;
    } else if (msg.type === 'STOP_STT') {
      try {
        if (stt && stt.listening) stt.stop();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, err: e && e.message });
      }
      return true;
    }
  });

  // Optionally: expose for debugging on the page
  window.__hoda_content_stt = {
    ensureSTT: ensureSTT,
    version: '1.0'
  };
})();

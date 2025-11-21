# CRITICAL: Architecture Issue with Page Reading

**Date:** November 21, 2025
**Severity:** 🔴 CRITICAL - Fundamental Design Flaw
**Reporter:** User (expert observation)

---

## The Real Problem (User's Insight)

> "Why are we chunking? It feels like the function gets called before it can access the TTS or start it, and it just keeps getting called and reset"

**This is 100% CORRECT.** The user has identified a fundamental architectural flaw.

---

## Root Cause: Wrong Abstraction Layer

### **The Architecture Mismatch:**

We have **TWO LAYERS** of text processing that conflict:

1. **PageReader Layer** - Breaks page into blocks (paragraphs)
2. **FeedbackManager Layer** - Breaks text into chunks (sentences)

**The Problem Flow:**

```javascript
PageReader:
  Block 1: "This is paragraph one with multiple sentences. It has more content."
    ↓
  Calls speakLong("This is paragraph one...")
    ↓
  speakLong() calls this.stopSpeech()  ← ⚠️ STOPS ANY EXISTING SPEECH!
    ↓
  Breaks into chunks: ["This is paragraph one...", "It has more content."]
    ↓
  Speaks chunk 1: "This is paragraph one..."
    ↓ (50ms delay)
  Speaks chunk 2: "It has more content."
    ↓
  Callback fires → Block 1 complete
    ↓
  Block 2: "This is paragraph two..."
    ↓
  Calls speakLong("This is paragraph two...")
    ↓
  speakLong() calls this.stopSpeech()  ← ⚠️ STOPS CHUNK FROM BLOCK 1!
```

### **The Cycle of Resets:**

Every time a new block starts:
1. `speakLong()` is called
2. `this.stopSpeech()` cancels ALL existing speech
3. New chunks are created
4. Old chunks are abandoned mid-speech
5. Creates a reset/restart cycle

---

## Why Chunking Exists

### **Browser Limitation: Character Limits**

`SpeechSynthesisUtterance` has limitations:

- **Chrome/Edge:** ~32,767 characters max
- **Firefox:** ~4,096 characters max
- **Safari:** ~Varies, often smaller

**Without chunking:** Long paragraphs would be truncated or fail entirely.

### **But the Current Implementation is Wrong**

The chunking should happen **INSIDE** `speakLong()` for a SINGLE block, not across multiple blocks.

---

## The Fundamental Issue

### **Problem 1: speakLong() Calls stopSpeech()**

**Location:** `content.js:840`

```javascript
speakLong(text, onComplete) {
  this.stopSpeech();  // ⚠️ KILLS ANY PREVIOUS SPEECH!

  // This means:
  // - If Block 1 is still speaking
  // - And Block 2 calls speakLong()
  // - Block 1 gets killed
  // - Creates endless reset cycle
}
```

**Why This Exists:** Designed for single-shot "speak this text" use case, not continuous reading.

### **Problem 2: Wrong Abstraction**

PageReader shouldn't call `speakLong()` for each block. It should either:

**Option A:** Call a lower-level `speak()` that doesn't chunk or reset
**Option B:** Concatenate all blocks and call `speakLong()` ONCE

---

## Evidence of the Issue

### **What's Probably Happening:**

```
Time 0ms:    Block 1 starts → speakLong("Block 1 text")
Time 5ms:    stopSpeech() called → cancels nothing (first block)
Time 10ms:   TTS starts speaking Block 1 chunk 1
Time 1000ms: Minimum duration enforced
Time 1000ms: Block 1 "completes" (due to MIN_DURATION)
Time 1001ms: Block 2 starts → speakLong("Block 2 text")
Time 1006ms: stopSpeech() called → CANCELS Block 1 that's still speaking! ⚠️
Time 1010ms: TTS starts speaking Block 2 chunk 1
Time 2000ms: Minimum duration enforced
Time 2000ms: Block 2 "completes"
Time 2001ms: Block 3 starts → speakLong("Block 3 text")
Time 2006ms: stopSpeech() called → CANCELS Block 2! ⚠️

Result: You hear fragments, constant interruptions, rapid jumping
```

---

## Why You See Scrolling

Yes, scrolling IS implemented:

```javascript
// Line 1861-1863
if (this.config.scrollToBlock) {
  this.stateManager.scrollToCurrentBlock();
}
```

**But it scrolls every ~1 second** as it jumps to new blocks, which feels janky because:
- Speech doesn't actually complete naturally
- Forced 1-second minimum creates artificial rhythm
- Visual highlighting jumps every second
- Not synchronized with actual speech

---

## The Real Solution

### **Option 1: Single speakLong() Call for Entire Page** (Simplest)

```javascript
async readPage() {
  const blocks = this.extractor.extractContent();

  if (blocks.length === 0) {
    return this.announceError('No readable content on this page');
  }

  // Concatenate ALL blocks into single text
  const fullText = blocks.map(block => {
    let text = block.text;
    if (block.isHeading) {
      const level = block.type.replace('h', '');
      text = `Heading ${level}. ${text}`;
    }
    return text;
  }).join('. '); // Join with pause

  // Announce start
  await this.announce('Reading page');

  // Read ENTIRE page in one speakLong() call
  return new Promise((resolve) => {
    this.tts.speak(fullText, {
      onEnd: () => {
        this.announce('End of page');
        resolve({ success: true });
      },
      onError: (error) => {
        resolve({ success: false, error: error.message });
      }
    });
  });
}
```

**Pros:**
- No interruptions
- No stopSpeech() resets
- Natural flow
- Simple

**Cons:**
- Can't pause between paragraphs
- Can't navigate paragraphs during reading
- Can't highlight current paragraph (don't know which one is speaking)

### **Option 2: Don't Call stopSpeech() in speakLong()** (Better)

Create a new method `speakLongContinuous()` that doesn't reset:

```javascript
speakLongContinuous(text, onComplete) {
  // DON'T call stopSpeech() - let existing speech finish

  const chunks = this._chunkTextToSentences(text, 1600);
  if (!chunks || !chunks.length) {
    if (onComplete) onComplete();
    return;
  }

  // Queue chunks instead of replacing
  this._tts.chunks.push(...chunks);
  this._tts.onAllChunksComplete = onComplete;

  // Only start if not already speaking
  if (!this.isSpeaking) {
    this._tts.autoContinue = true;
    this._tts.stopped = false;
    this._setSpeaking(true);
    this._speakNextChunk();
  }
}
```

### **Option 3: Use speechSynthesis Queue Directly** (Cleanest)

Don't manage chunks manually - let browser queue utterances:

```javascript
speakBlock(text, onComplete) {
  const utterance = new SpeechSynthesisUtterance(text);

  // Set voice, rate, pitch
  const voice = this.getPreferredVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = this.settings.ttsRate ?? 1.0;
  utterance.pitch = this.settings.ttsPitch ?? 1.0;
  utterance.volume = 0.95;

  utterance.onend = () => {
    if (onComplete) onComplete();
  };

  utterance.onerror = (error) => {
    console.error('[TTS] Error:', error);
    if (onComplete) onComplete(); // Continue anyway
  };

  // Let browser queue handle it
  window.speechSynthesis.speak(utterance);
}
```

Then PageReader calls this for each block:

```javascript
async readBlock(block) {
  return new Promise((resolve) => {
    this.tts.speakBlock(block.text, () => {
      resolve();
    });
  });
}
```

**This solves:**
- ✅ No stopSpeech() resets
- ✅ Natural browser queueing
- ✅ Can still track which block is speaking
- ✅ Can still pause/resume (use speechSynthesis.pause())
- ✅ Can still scroll and highlight

---

## Recommended Fix (Option 3 - Cleanest)

Replace the complex chunking system with simple per-block utterances:

1. **Remove chunking from PageReader flow**
2. **Create `speakBlock()` method** - speaks single utterance
3. **Let browser queue handle it** - no manual chunk management
4. **Keep block-by-block processing** - maintains paragraph navigation
5. **Remove stopSpeech() from speakLong()** - or don't use speakLong for reading

---

## Why Current Approach Fails

### The Fundamental Flaw:

```
speakLong() was designed for: "Speak this text, interrupt anything else"
PageReader needs: "Speak this block, then next block, then next..."

Using speakLong() for PageReader is like:
- Starting a video
- Stopping it after 1 second
- Starting a different video
- Stopping it after 1 second
- Repeat...

No wonder it feels broken!
```

---

## Scrolling Question

**Q: Does it scroll as it reads?**

**A:** Yes, scrolling IS implemented (`scrollToCurrentBlock()` on line 1862).

**But:** It scrolls every time a new block starts (every ~1 second with MIN_DURATION), which feels jumpy because the blocks are being reset constantly, not because scrolling is broken.

**With proper fix:** Scrolling will feel smooth and natural, synchronized with actual speech completion.

---

## Action Items

### Immediate (Critical):

**Option A - Quick Fix:**
Remove `this.stopSpeech()` from beginning of `speakLong()` when called by PageReader

**Option B - Proper Fix:**
Implement Option 3 - Use browser's speech queue directly without chunking complexity

### Which to choose?

**I recommend Option B** because:
1. Fixes root cause, not symptom
2. Simpler code (remove complexity)
3. More reliable (use browser's native queue)
4. Better performance
5. Easier to maintain

---

**Status:** Architecture flaw identified by user
**User Observation:** 100% accurate
**Next:** Implement proper fix (Option 3)

/**
 * Volume Visualizer - Real-time audio visualization for microphone input
 * Displays 8 square bars that animate based on audio frequency data
 */
class VolumeVisualizer {
  constructor() {
    this.bars = document.querySelectorAll('.volume-bar');
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.animationId = null;
    this.isActive = false;
  }

  async start(stream) {
    if (!stream || this.isActive) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 32; // Small FFT for 8 bars
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      this.isActive = true;
      this.visualize();
    } catch (err) {
      console.error('[Visualizer] Start failed:', err);
    }
  }

  visualize() {
    if (!this.isActive) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Update each bar
    this.bars.forEach((bar, index) => {
      const value = dataArray[index] || 0;
      const height = Math.max(10, (value / 255) * 150); // 10px min, 150px max
      bar.style.height = `${height}px`;
      bar.classList.add('active');
    });

    this.animationId = requestAnimationFrame(() => this.visualize());
  }

  stop() {
    this.isActive = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Reset bars
    this.bars.forEach(bar => {
      bar.style.height = '10px';
      bar.classList.remove('active');
    });

    if (this.microphone) {
      this.microphone.disconnect();
      
      // Stop the audio tracks
      const stream = this.microphone.mediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      this.microphone = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
  }
}

// Export for use in popup.js
window.VolumeVisualizer = VolumeVisualizer;
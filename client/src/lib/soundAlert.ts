/**
 * Web Audio API Ringtone Generator for Driver New Order Alerts (تنبيهات ورنين الطلبات الجديدة)
 */

class SoundAlertEngine {
  private audioCtx: AudioContext | null = null;

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  public unlock() {
    try {
      this.initAudio();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (_) {}
  }

  public playNewOrderRingtone() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // 🎶 نغمة رنين ثنائية عالية الوضوح والتمييز للطلب الجديد
      // D5 -> A5 -> D5 -> A5
      const notes = [
        { freq: 587.33, start: 0.0, duration: 0.18 },
        { freq: 880.00, start: 0.2, duration: 0.22 },
        { freq: 587.33, start: 0.45, duration: 0.18 },
        { freq: 880.00, start: 0.65, duration: 0.30 },
      ];

      notes.forEach(({ freq, start, duration }) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.35, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } catch (err) {
      console.warn('⚠️ متعذر تشغيل نغمة التنبيه الصوتي:', err);
    }
  }
}

export const soundAlert = new SoundAlertEngine();

// تفعيل الصوت تلقائياً عند أول تفاعل من المستخدم مع الشاشة
if (typeof window !== 'undefined') {
  const unlockHandler = () => {
    soundAlert.unlock();
    window.removeEventListener('click', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
  };

  window.addEventListener('click', unlockHandler, { once: true });
  window.addEventListener('touchstart', unlockHandler, { once: true });
  window.addEventListener('keydown', unlockHandler, { once: true });
}

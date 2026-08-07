/**
 * Web Audio API & Continuous Ringtone Generator for Driver New Order Alerts
 * (تنبيهات ورنين الطلبات الجديدة المستمر حتى استلام الطلب من قبل أي سائق)
 */

class SoundAlertEngine {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private isMuted: boolean = false;
  private activeRinging: boolean = false;
  private activeNotification: Notification | null = null;
  private fallbackAudio: HTMLAudioElement | null = null;

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

  public isRinging(): boolean {
    return this.activeRinging;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopRingtone();
    } else {
      this.startContinuousRingtone();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * بدء نغمة رنين مستمرة بدون توقف تنبه السائق حتى يتم استلام الطلب أو معالجته من قبل أي سائق
   */
  public startContinuousRingtone() {
    if (this.isMuted) return;
    this.activeRinging = true;

    this.unlock();

    // تشغيل إشعار النظام المباشر إذا كان التطبيق مغلقاً أو في الخلفية
    this.triggerSystemNotification();

    if (this.ringtoneInterval) {
      return; // النغمة تعمل بالفعل مسبقاً
    }

    // تشغيل ضربة الصوت الأولى فوراً
    this.playTonePulse();

    // تكرار النغمة بانتظام كل 1.2 ثانية طالما هناك طلب معلق ولم يتم استلامه
    this.ringtoneInterval = setInterval(() => {
      if (!this.activeRinging) {
        this.stopRingtone();
        return;
      }
      this.playTonePulse();
    }, 1200);
  }

  /**
   * إشعار الجهاز (System / Push Notification) مع الاهتزاز عند تلقي طلب جديد
   */
  private triggerSystemNotification() {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        if (!this.activeNotification) {
          const notifOptions: any = {
            body: 'يوجد طلب جديد بانتظار الاستلام. اضغط لقبول الطلب فوراً.',
            icon: '/icon-192.png',
            tag: 'driver_new_order_alert',
            requireInteraction: true,
            vibrate: [300, 100, 300, 100, 300, 100, 500],
          };
          this.activeNotification = new Notification('🔔 طلب جديد متاح!', notifOptions);

          this.activeNotification.onclick = () => {
            window.focus();
            if (this.activeNotification) {
              this.activeNotification.close();
              this.activeNotification = null;
            }
          };
        }
      }
    } catch (e) {
      console.warn('Notification error:', e);
    }
  }

  /**
   * إيقاف نغمة الرنين فوراً عند قبول الطلب من أي سائق أو عند انعدام الطلبات المتاحة
   */
  public stopRingtone() {
    this.activeRinging = false;
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.activeNotification) {
      try {
        this.activeNotification.close();
      } catch (_) {}
      this.activeNotification = null;
    }
  }

  public playNewOrderRingtone() {
    this.startContinuousRingtone();
  }

  private playTonePulse() {
    try {
      this.unlock();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // 🎶 نغمة رنين جرس عالية الوضوح والتمييز للطلب الجديد (E5 -> B5 -> E5 -> B5)
      const notes = [
        { freq: 659.25, start: 0.0, duration: 0.18 },
        { freq: 987.77, start: 0.2, duration: 0.22 },
        { freq: 659.25, start: 0.45, duration: 0.18 },
        { freq: 987.77, start: 0.65, duration: 0.35 },
      ];

      notes.forEach(({ freq, start, duration }) => {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.5, now + start);
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

// تفعيل الصوت وإذن الإشعارات تلقائياً عند تفاعل السائق أو فتح التطبيق
if (typeof window !== 'undefined') {
  const unlockAudioHandler = () => {
    soundAlert.unlock();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, unlockAudioHandler, { passive: true });
  });

  window.addEventListener('focus', () => {
    soundAlert.unlock();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      soundAlert.unlock();
    }
  });
}

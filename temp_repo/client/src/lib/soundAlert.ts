/**
 * Web Audio API & Continuous Ringtone Generator for Driver New Order Alerts
 * (تنبيهات ورنين الطلبات الجديدة المستمر حتى استلام الطلب من قبل أي سائق)
 */

import { androidBridge } from './androidBridge';

class SoundAlertEngine {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private isMuted: boolean = false;
  private activeRinging: boolean = false;
  private activeNotification: Notification | null = null;
  private activeOscillators: OscillatorNode[] = [];

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

  public isUnlocked(): boolean {
    return !!(this.audioCtx && this.audioCtx.state === 'running');
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
   * طلب إذن إشعارات النظام من السائق لضمان الرنين والتنبيه أثناء وجود التطبيق بالخلفية
   */
  public async requestNotificationPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      } catch (_) {}
    }
  }

  /**
   * بدء نغمة رنين مستمرة بدون توقف تنبه السائق حتى يتم استلام الطلب أو معالجته من قبل أي سائق
   */
  public startContinuousRingtone() {
    if (this.isMuted) return;
    this.activeRinging = true;

    this.unlock();

    // تشغيل إشعار النظام المباشر إذا كان التطبيق في الخلفية
    this.triggerSystemNotification();

    // Play native ringtone if available
    if (androidBridge.isAvailable()) {
      androidBridge.playRingtone();
    }

    if (this.ringtoneInterval) {
      return; // النغمة تعمل بالفعل مسبقاً
    }

    // تشغيل ضربة الصوت الأولى فوراً
    this.playTonePulse();

    // تكرار النغمة بانتظام كل 1.1 ثانية طالما هناك طلب معلق ولم يتم استلامه
    this.ringtoneInterval = setInterval(() => {
      if (!this.activeRinging) {
        this.stopRingtone();
        return;
      }
      this.playTonePulse();
    }, 1100);
  }

  /**
   * إشعار الجهاز (System / Push Notification) مع الاهتزاز عند تلقي طلب جديد
   */
  private triggerSystemNotification() {
    try {
      const title = '🔔 طلب جديد متاح للجميع!';
      const body = '📢 يوجد طلب توصيل جديد متاح! اضغط هنا لفتح التطبيق وقبول الطلب فوراً.';
      
      // Native App Push Notification (if in Android WebView)
      if (androidBridge.isAvailable()) {
        androidBridge.showNotification(title, body);
      }
      
      // Web Notification API (Fallback for browsers)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        if (!this.activeNotification) {
          const notifOptions: any = {
            body: body,
            icon: '/icon-192.png',
            tag: 'driver_new_order_alert',
            requireInteraction: true,
            vibrate: [350, 100, 350, 100, 450],
          };
          this.activeNotification = new Notification(title, notifOptions);

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
    
    // Stop native ringtone if available
    if (androidBridge.isAvailable()) {
      androidBridge.stopRingtone();
    }
    
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }

    // إيقاف جميع نغمات الصوت الجارية فوراً
    try {
      this.activeOscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (_) {}
      });
      this.activeOscillators = [];
    } catch (_) {}

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
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
    if (!this.activeRinging || this.isMuted) return;

    try {
      this.unlock();

      // اهتزاز الهاتف أثناء الرنين
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([250, 100, 250, 100, 350]);
        } catch (_) {}
      }

      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // 🎶 نغمة رنين جرس عالية الوضوح والتمييز للطلب الجديد (لحن متصاعد منبه ومتميز)
      const notes = [
        { freq: 783.99, start: 0.0, duration: 0.16 }, // G5
        { freq: 1046.50, start: 0.18, duration: 0.20 }, // C6
        { freq: 1318.51, start: 0.40, duration: 0.22 }, // E6
        { freq: 1567.98, start: 0.64, duration: 0.35 }, // G6 (نغمة رنانة تدوم)
      ];

      notes.forEach(({ freq, start, duration }) => {
        if (!this.activeRinging) return;
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();

        // استخدام مزيج نغمة مثل جرس المنبه
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.8, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx!.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);

        this.activeOscillators.push(osc);
        osc.onended = () => {
          this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
        };
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

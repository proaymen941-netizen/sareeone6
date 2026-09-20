import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  MapPin, 
  Navigation, 
  ShieldCheck, 
  Clock, 
  Sparkles, 
  Store, 
  ChevronLeft,
  Loader2,
  Lock,
  AlertCircle
} from 'lucide-react';
import { androidBridge } from '@/lib/androidBridge';

interface LocationPermissionModalProps {
  onPermissionGranted: (position: GeolocationPosition) => void;
  onPermissionDenied: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function LocationPermissionModal({ 
  onPermissionGranted, 
  onPermissionDenied,
  isOpen: externalIsOpen,
  onClose
}: LocationPermissionModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    setInternalIsOpen(open);
    if (!open && onClose) {
      onClose();
    }
  };

  useEffect(() => {
    // Check if user already dismissed or granted this session or previously
    const hasGrantedBefore = localStorage.getItem('location_permission_granted');
    const dismissedThisSession = sessionStorage.getItem('location_modal_dismissed');

    if (dismissedThisSession) {
      return;
    }

    if (hasGrantedBefore === 'true') {
      getCurrentLocation(true);
      return;
    }

    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (permission.state === 'granted') {
          getCurrentLocation(true);
        } else if (permission.state === 'denied') {
          // If already denied, show modal gently so they can know why
          setInternalIsOpen(true);
        } else {
          // prompt state
          setInternalIsOpen(true);
        }
      } catch (error) {
        setInternalIsOpen(true);
      }
    } else {
      setInternalIsOpen(true);
    }
  };

  const getCurrentLocation = (isSilent = false) => {
    if (!isSilent) {
      setIsLocating(true);
      setErrorMessage(null);
    }

    // Check Android native bridge first if available
    if (androidBridge.isAvailable()) {
      androidBridge.requestLocationPermission();
    }

    if (!('geolocation' in navigator)) {
      setIsLocating(false);
      setErrorMessage('متصفحك لا يدعم تحديد الموقع الجغرافي');
      if (!isSilent) {
        setTimeout(() => {
          handleDeny();
        }, 1500);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        localStorage.setItem('location_permission_granted', 'true');
        onPermissionGranted(position);
        setIsOpen(false);
      },
      (error) => {
        setIsLocating(false);
        console.warn('Geolocation error:', error?.message);
        
        if (!isSilent) {
          if (error.code === error.PERMISSION_DENIED) {
            setErrorMessage('تم رفض الإذن. يمكنك تفعيل الموقع من إعدادات المتصفح أو المتابعة يدوياً.');
          } else if (error.code === error.TIMEOUT) {
            setErrorMessage('استغرق تحديد الموقع وقتاً أطول من المتوقع.');
          } else {
            setErrorMessage('تعذر تحديد الموقع تلقائياً.');
          }
        } else {
          setInternalIsOpen(true);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleAllow = () => {
    getCurrentLocation(false);
  };

  const handleDeny = () => {
    sessionStorage.setItem('location_modal_dismissed', 'true');
    onPermissionDenied();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDeny();
    }}>
      <DialogContent 
        className="sm:max-w-md p-0 overflow-hidden border-0 rounded-3xl bg-white shadow-2xl z-[100]" 
        dir="rtl"
      >
        {/* Animated Gradient Hero Banner */}
        <div className="relative bg-gradient-to-br from-[#FF5722] via-[#F4511E] to-[#E64A19] px-6 pt-8 pb-10 text-white overflow-hidden text-center">
          
          {/* Subtle Background Glows & Pattern */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/15 rounded-full blur-xl pointer-events-none" />

          {/* Central Animated Radar Beacon */}
          <div className="relative mx-auto mb-4 w-20 h-20 flex items-center justify-center">
            {/* Pulsing radar waves */}
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-60 pointer-events-none" />
            <div className="absolute -inset-2 rounded-full bg-white/10 animate-pulse pointer-events-none" />
            
            {/* Core Icon Container */}
            <div className="relative w-16 h-16 rounded-2xl bg-white text-[#F05215] flex items-center justify-center shadow-lg shadow-black/10 transform transition-transform group-hover:scale-105">
              <MapPin className="h-8 w-8 text-[#F05215]" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
          </div>

          {/* Title & Subtitle */}
          <DialogTitle className="text-xl md:text-2xl font-black tracking-tight text-white mb-2">
            حدد موقعك لتجربة أسرع وأدق
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm text-white/90 font-medium leading-relaxed max-w-xs mx-auto">
            نوفر لك تجربة طلب وتوصيل فائقة الدقة والسرعة بناءً على موقعك الحالي
          </DialogDescription>
        </div>

        {/* Modal Body & Benefits */}
        <div className="p-6 space-y-5">
          
          {/* Error notification if any */}
          {errorMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 text-xs font-medium animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Key Advantages Grid */}
          <div className="space-y-2.5">
            
            {/* Benefit 1 */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200/80 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-orange-100/70 text-[#F05215] flex items-center justify-center shrink-0 shadow-2xs">
                <Store className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <div className="font-black text-slate-800 text-[13px]">أقرب المطاعم والمتاجر</div>
                <div className="text-slate-500 font-medium">اكتشف المطاعم والعروض الحصرية المتاحة لمنطقتك</div>
              </div>
            </div>

            {/* Benefit 2 */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200/80 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Navigation className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <div className="font-black text-slate-800 text-[13px]">توصيل فوري ودقيق لبابك</div>
                <div className="text-slate-500 font-medium">حساب رسوم التوصيل الصحيحة وتتبع المندوب على الخريطة</div>
              </div>
            </div>

            {/* Benefit 3 */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-orange-200/80 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <div className="font-black text-slate-800 text-[13px]">أمان وخصوصية تامة</div>
                <div className="text-slate-500 font-medium">يستخدم موقعك حصرياً لتسليم وتوصيل طلبك فقط</div>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <Button 
              onClick={handleAllow}
              disabled={isLocating}
              className="w-full h-12 md:h-13 rounded-2xl bg-gradient-to-r from-[#F05215] via-[#FF5722] to-[#FF7840] hover:from-[#E64A19] hover:to-[#F4511E] text-white font-black text-sm gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] border-none"
            >
              {isLocating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري تحديد موقعك بدقة...</span>
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" />
                  <span>السماح بتحديد الموقع تلقائياً</span>
                </>
              )}
            </Button>

            <Button 
              variant="ghost" 
              onClick={handleDeny}
              disabled={isLocating}
              className="w-full h-10 rounded-2xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold text-xs"
            >
              <span>تخطي والمتابعة يدوياً</span>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            </Button>
          </div>

          {/* Trust Footer */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium pt-1">
            <Lock className="h-3 w-3 text-slate-400" />
            <span>تطبيق السريع ون · بياناتك مشفرة ومحمية</span>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
export default LocationPermissionModal;

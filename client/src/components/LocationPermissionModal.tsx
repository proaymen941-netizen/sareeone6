import { useState, useEffect, useRef } from 'react';
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
  Store, 
  Loader2,
  ChevronLeft,
  AlertCircle
} from 'lucide-react';
import { androidBridge } from '@/lib/androidBridge';
import { useUserLocation } from '@/context/LocationContext';

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
  const { getCurrentLocation: refreshContextLocation } = useUserLocation();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    setInternalIsOpen(open);
    if (!open && onClose) {
      onClose();
    }
  };

  useEffect(() => {
    // Check if user already granted or dismissed
    const hasGrantedBefore = localStorage.getItem('location_permission_granted') === 'true';
    const dismissedThisSession = sessionStorage.getItem('location_modal_dismissed') === 'true';

    if (hasGrantedBefore) {
      // Already granted in a previous session, silently fetch position
      attemptFastLocation(true);
      return;
    }

    if (dismissedThisSession) {
      return;
    }

    // Check modern browser permission query
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((permission) => {
          if (permission.state === 'granted') {
            localStorage.setItem('location_permission_granted', 'true');
            attemptFastLocation(true);
          } else {
            setInternalIsOpen(true);
          }
        })
        .catch(() => {
          setInternalIsOpen(true);
        });
    } else {
      setInternalIsOpen(true);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const attemptFastLocation = (isSilent = false) => {
    if (!isSilent) {
      setIsLocating(true);
      setErrorMessage(null);
    }

    // Request Android native permission if in Android App
    if (androidBridge.isAvailable()) {
      androidBridge.requestLocationPermission();
    }

    if (!('geolocation' in navigator)) {
      setIsLocating(false);
      if (!isSilent) {
        setErrorMessage('المتصفح لا يدعم تحديد الموقع');
        setTimeout(handleDeny, 1000);
      }
      return;
    }

    // Safety timeout after 6 seconds to prevent button freeze
    if (!isSilent) {
      timeoutRef.current = setTimeout(() => {
        setIsLocating(false);
        setErrorMessage('تعذر تحديد الموقع بدقة، يمكنك المتابعة يدوياً');
      }, 6000);
    }

    // Fast call with low accuracy first for instant response
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsLocating(false);
        localStorage.setItem('location_permission_granted', 'true');
        localStorage.setItem('user_latitude', String(position.coords.latitude));
        localStorage.setItem('user_longitude', String(position.coords.longitude));
        
        try {
          refreshContextLocation();
        } catch {
          // ignore
        }

        onPermissionGranted(position);
        setIsOpen(false);
      },
      (error) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsLocating(false);
        console.warn('Geolocation error:', error?.message);

        if (!isSilent) {
          if (error.code === error.PERMISSION_DENIED) {
            setErrorMessage('تم رفض الإذن. يمكنك المتابعة يدوياً أو تفعيل الإذن من إعدادات المتصفح.');
            setTimeout(() => {
              handleDeny();
            }, 1800);
          } else {
            setErrorMessage('تعذر الحصول على الموقع حالياً، يمكنك المتابعة يدوياً.');
          }
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 180000
      }
    );
  };

  const handleAllow = () => {
    attemptFastLocation(false);
  };

  const handleDeny = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    sessionStorage.setItem('location_modal_dismissed', 'true');
    onPermissionDenied();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDeny();
    }}>
      <DialogContent 
        className="w-[90vw] max-w-[360px] p-0 overflow-hidden border-0 rounded-3xl bg-white shadow-2xl z-[100] mx-auto" 
        dir="rtl"
      >
        {/* Compact Header */}
        <div className="relative bg-gradient-to-br from-[#FF5722] via-[#F4511E] to-[#E64A19] px-5 pt-6 pb-6 text-white text-center">
          
          {/* Background Glow */}
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/15 rounded-full blur-xl pointer-events-none" />
          
          {/* Animated Pin Beacon */}
          <div className="relative mx-auto mb-3 w-14 h-14 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-60 pointer-events-none" />
            <div className="relative w-12 h-12 rounded-2xl bg-white text-[#F05215] flex items-center justify-center shadow-md">
              <MapPin className="h-6 w-6 text-[#F05215]" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
          </div>

          <DialogTitle className="text-lg font-black tracking-tight text-white mb-1">
            السماح بتحديد موقعك
          </DialogTitle>
          <DialogDescription className="text-xs text-white/90 font-medium leading-relaxed max-w-[280px] mx-auto">
            لعرض أقرب المطاعم والمتاجر وتحديد رسوم وتتبع التوصيل بدقة
          </DialogDescription>
        </div>

        {/* Compact Body */}
        <div className="p-5 space-y-4">
          
          {/* Error / Warning Notice */}
          {errorMessage && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-[11px] font-medium animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Key Quick Badges */}
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-700">
            <div className="p-2 rounded-xl bg-orange-50/70 border border-orange-100 flex flex-col items-center gap-1">
              <Store className="h-4 w-4 text-[#F05215]" />
              <span className="truncate">أقرب المتاجر</span>
            </div>
            <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-col items-center gap-1 text-blue-900">
              <Navigation className="h-4 w-4 text-blue-600" />
              <span className="truncate">توصيل دقيق</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 flex flex-col items-center gap-1 text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="truncate">خصوصية تامة</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <Button 
              onClick={handleAllow}
              disabled={isLocating}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F05215] to-[#FF7840] hover:from-[#E64A19] hover:to-[#F4511E] text-white font-black text-xs gap-2 shadow-md shadow-orange-500/20 active:scale-95 transition-all"
            >
              {isLocating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري تحديد موقعك...</span>
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" />
                  <span>السماح بالوصول للموقع</span>
                </>
              )}
            </Button>

            <Button 
              variant="ghost" 
              onClick={handleDeny}
              disabled={isLocating}
              className="w-full h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 font-bold text-[11px]"
            >
              <span>تخطي الآن</span>
              <ChevronLeft className="h-3 w-3 mr-0.5" />
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
export default LocationPermissionModal;

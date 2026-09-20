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
  onPermissionGranted: (position?: GeolocationPosition) => void;
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
    // Check if user already granted or permanently dismissed
    const hasGrantedBefore = localStorage.getItem('location_permission_granted') === 'true';
    const dismissedThisSession = sessionStorage.getItem('location_modal_dismissed') === 'true';

    if (hasGrantedBefore) {
      // Already granted in a previous session, silently fetch position without modal
      attemptFastLocation(true);
      return;
    }

    if (dismissedThisSession) {
      return;
    }

    // Check modern browser permission query
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
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

    // Trigger Native Android Bridge permission if available
    try {
      if (androidBridge.isAvailable()) {
        androidBridge.requestLocationPermission();
      }
    } catch (e) {
      console.warn('Android bridge location error:', e);
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setIsLocating(false);
      localStorage.setItem('location_permission_granted', 'true');
      if (!isSilent) {
        onPermissionGranted();
        setIsOpen(false);
      }
      return;
    }

    // Ultra-responsive fallback timeout (3s) to prevent any UI freeze
    let resolved = false;
    if (!isSilent) {
      timeoutRef.current = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          setIsLocating(false);
          localStorage.setItem('location_permission_granted', 'true');
          try {
            refreshContextLocation();
          } catch {}
          onPermissionGranted();
          setIsOpen(false);
        }
      }, 3000);
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (resolved) return;
          resolved = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setIsLocating(false);
          
          localStorage.setItem('location_permission_granted', 'true');
          localStorage.setItem('user_latitude', String(position.coords.latitude));
          localStorage.setItem('user_longitude', String(position.coords.longitude));
          
          try {
            refreshContextLocation();
          } catch {}

          onPermissionGranted(position);
          setIsOpen(false);
        },
        (error) => {
          if (resolved) return;
          resolved = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setIsLocating(false);
          console.warn('Geolocation error:', error?.message);

          if (!isSilent) {
            // Still mark as granted so user is not prompted again continuously, and proceed
            localStorage.setItem('location_permission_granted', 'true');
            sessionStorage.setItem('location_modal_dismissed', 'true');
            onPermissionGranted();
            setIsOpen(false);
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 3000,
          maximumAge: 300000 // 5 minutes cache
        }
      );
    } catch {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsLocating(false);
      localStorage.setItem('location_permission_granted', 'true');
      onPermissionGranted();
      setIsOpen(false);
    }
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
        className="w-[88vw] max-w-[340px] p-0 overflow-hidden border-0 rounded-3xl bg-white shadow-2xl z-[100] mx-auto" 
        dir="rtl"
      >
        {/* Compact Header */}
        <div className="relative bg-gradient-to-br from-[#FF5722] via-[#F4511E] to-[#E64A19] px-4 pt-5 pb-4 text-white text-center">
          
          {/* Animated Pin Beacon */}
          <div className="relative mx-auto mb-2.5 w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-50 pointer-events-none" />
            <div className="relative w-11 h-11 rounded-2xl bg-white text-[#F05215] flex items-center justify-center shadow-md">
              <MapPin className="h-6 w-6 text-[#F05215]" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
          </div>

          <DialogTitle className="text-base font-black tracking-tight text-white mb-0.5">
            تحديد موقعك تلقائياً
          </DialogTitle>
          <DialogDescription className="text-[11px] text-white/90 font-medium leading-tight max-w-[260px] mx-auto">
            لعرض المتاجر القريبة وحساب رسوم التوصيل بدقة
          </DialogDescription>
        </div>

        {/* Compact Body */}
        <div className="p-4 space-y-3.5">
          
          {/* Key Quick Badges */}
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold text-slate-700">
            <div className="p-2 rounded-xl bg-orange-50/80 border border-orange-100 flex flex-col items-center gap-0.5">
              <Store className="h-3.5 w-3.5 text-[#F05215]" />
              <span className="truncate">أقرب المتاجر</span>
            </div>
            <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-100 flex flex-col items-center gap-0.5 text-blue-900">
              <Navigation className="h-3.5 w-3.5 text-blue-600" />
              <span className="truncate">توصيل دقيق</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-100 flex flex-col items-center gap-0.5 text-emerald-900">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span className="truncate">خصوصية تامة</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-0.5">
            <Button 
              onClick={handleAllow}
              disabled={isLocating}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-[#F05215] to-[#FF7840] hover:from-[#E64A19] hover:to-[#F4511E] text-white font-black text-xs gap-2 shadow-sm active:scale-95 transition-all"
            >
              {isLocating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>جاري التحديد...</span>
                </>
              ) : (
                <>
                  <Navigation className="h-3.5 w-3.5" />
                  <span>السماح بالوصول للموقع</span>
                </>
              )}
            </Button>

            <Button 
              variant="ghost" 
              onClick={handleDeny}
              disabled={isLocating}
              className="w-full h-7 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 font-bold text-[10px]"
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

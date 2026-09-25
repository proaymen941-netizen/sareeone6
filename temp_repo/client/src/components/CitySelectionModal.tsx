import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Building2, 
  Check, 
  Globe, 
  Server, 
  ExternalLink, 
  Sparkles, 
  ChevronLeft,
  X,
  Radio,
  Navigation
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUiSettings } from '@/context/UiSettingsContext';
import { useToast } from '@/hooks/use-toast';

export interface CityItem {
  id: string;
  name: string;
  subtitle?: string;
  serverUrl?: string;
  isCurrent?: boolean;
  tag?: string;
  icon?: string;
}

interface CitySelectionModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  allowDismiss?: boolean;
}

export const CitySelectionModal: React.FC<CitySelectionModalProps> = ({
  isOpen: propIsOpen,
  onClose,
  allowDismiss = true,
}) => {
  const { getSetting } = useUiSettings();
  const { toast } = useToast();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string>(() => {
    return localStorage.getItem('selected_city_id') || 'current';
  });
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectingCityName, setRedirectingCityName] = useState('');

  // Settings values
  const isEnabled = getSetting('enable_city_selection') === 'true';
  const currentCityName = getSetting('current_city_name') || 'تعز';
  const currentCitySubtitle = getSetting('current_city_subtitle') || 'الفرع والسيرفر الرئيسي (متصل)';
  const targetCityName = getSetting('target_city_name') || 'عدن';
  const targetCitySubtitle = getSetting('target_city_subtitle') || 'سيرفر عدن والخدمات الخاصة';
  const targetCityServerUrl = getSetting('target_city_server_url') || '';
  const modalTitle = getSetting('city_selection_title') || 'اختر مدينتك';
  const modalSubtitle = getSetting('city_selection_subtitle') || 'حدد المدينة لعرض المطاعم، المتاجر والخدمات المتوفرة في منطقتك';
  const citiesConfigJson = getSetting('cities_config_json') || '';

  // Build cities list
  let citiesList: CityItem[] = [];

  if (citiesConfigJson) {
    try {
      const parsed = JSON.parse(citiesConfigJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        citiesList = parsed;
      }
    } catch {
      // fallback to standard two-city mode
    }
  }

  if (citiesList.length === 0) {
    citiesList = [
      {
        id: 'current',
        name: currentCityName,
        subtitle: currentCitySubtitle,
        isCurrent: true,
        tag: 'السيرفر الحالي',
        icon: '🏛️',
      },
      {
        id: 'target',
        name: targetCityName,
        subtitle: targetCitySubtitle,
        serverUrl: targetCityServerUrl,
        isCurrent: false,
        tag: targetCityServerUrl ? 'سيرفر مخصص' : 'قريباً',
        icon: '🌊',
      }
    ];
  }

  // Listen to open events
  useEffect(() => {
    const handleOpenEvent = () => {
      setInternalOpen(true);
    };

    window.addEventListener('openCitySelector', handleOpenEvent);
    return () => window.removeEventListener('openCitySelector', handleOpenEvent);
  }, []);

  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;

  const handleClose = () => {
    if (!allowDismiss && !localStorage.getItem('selected_city_name')) {
      // Must select a city
      return;
    }
    if (onClose) {
      onClose();
    } else {
      setInternalOpen(false);
    }
  };

  const handleSelectCity = (city: CityItem) => {
    setSelectedCityId(city.id);
    localStorage.setItem('selected_city_id', city.id);
    localStorage.setItem('selected_city_name', city.name);
    localStorage.setItem('city_chosen_first_time', 'true');
    if (city.serverUrl) {
      localStorage.setItem('selected_city_url', city.serverUrl);
    } else {
      localStorage.removeItem('selected_city_url');
    }

    // Broadcast city change
    window.dispatchEvent(new CustomEvent('cityChanged', { detail: city }));

    // If city has an external server URL
    if (city.serverUrl && (city.serverUrl.startsWith('http://') || city.serverUrl.startsWith('https://'))) {
      const isCurrentOrigin = city.serverUrl.includes(window.location.hostname);
      if (!isCurrentOrigin) {
        setIsRedirecting(true);
        setRedirectingCityName(city.name);

        setTimeout(() => {
          window.location.href = city.serverUrl!;
        }, 1200);
        return;
      }
    }

    toast({
      title: `📍 تم اختيار مدينة ${city.name}`,
      description: "تم تحديث الخدمات والمتاجر الخاصة بمدينتك بنجاح",
    });

    handleClose();
  };

  if (!isEnabled && propIsOpen === undefined) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent 
        className="w-[92vw] max-w-md p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white"
        dir="rtl"
      >
        {/* Header with vibrant gradient */}
        <div className="relative bg-gradient-to-br from-[#FF5722] via-[#F4511E] to-[#E64A19] px-6 pt-7 pb-6 text-white overflow-hidden">
          {/* Decorative blurs */}
          <div className="absolute -top-12 -right-8 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-black/10 blur-lg pointer-events-none" />

          {allowDismiss && (
            <button
              onClick={handleClose}
              className="absolute top-4 left-4 p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-all active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <div className="relative flex items-center gap-3.5 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <MapPin className="h-6 w-6 text-white animate-bounce" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white tracking-tight">
                {modalTitle}
              </DialogTitle>
              <span className="text-[11px] font-bold text-white/80 flex items-center gap-1 mt-0.5">
                <Sparkles className="h-3 w-3 text-yellow-300" />
                اختر منطقتك للوصول المباشر إلى السيرفر والخدمات
              </span>
            </div>
          </div>

          <DialogDescription className="text-xs text-white/90 leading-relaxed font-medium mt-2">
            {modalSubtitle}
          </DialogDescription>
        </div>

        {/* Redirecting State Overlay */}
        {isRedirecting ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center text-orange-600 animate-pulse">
              <Server className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">
                جاري الاتصال بسيرفر {redirectingCityName}...
              </h3>
              <p className="text-xs text-slate-500">
                يتم الآن توجيهك إلى سيرفر وقاعدة بيانات {redirectingCityName}
              </p>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full w-2/3 animate-pulse rounded-full" />
            </div>
          </div>
        ) : (
          /* City Selection Cards List */
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {citiesList.map((city) => {
              const isSelected = selectedCityId === city.id || (!localStorage.getItem('selected_city_id') && city.isCurrent);
              const hasExternalServer = Boolean(city.serverUrl && (city.serverUrl.startsWith('http://') || city.serverUrl.startsWith('https://')));

              return (
                <button
                  key={city.id}
                  onClick={() => handleSelectCity(city)}
                  className={`w-full text-right p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3.5 group relative ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/50 shadow-md ring-2 ring-orange-400/20'
                      : 'border-slate-100 hover:border-orange-200 hover:bg-slate-50/80 bg-white shadow-xs'
                  }`}
                >
                  {/* City Icon / Badge */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-105 ${
                    isSelected 
                      ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {city.icon ? (
                      <span>{city.icon}</span>
                    ) : city.isCurrent ? (
                      <Building2 className="h-6 w-6" />
                    ) : (
                      <Navigation className="h-6 w-6" />
                    )}
                  </div>

                  {/* City details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-base">
                        {city.name}
                      </span>
                      {city.tag && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          city.isCurrent 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : hasExternalServer
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {city.tag}
                        </span>
                      )}
                    </div>
                    {city.subtitle && (
                      <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                        {city.subtitle}
                      </p>
                    )}
                    {hasExternalServer && (
                      <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mt-1 truncate" dir="ltr">
                        <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{city.serverUrl}</span>
                      </div>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-xs">
                        <Check className="h-4 w-4 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-orange-300" />
                    )}
                  </div>
                </button>
              );
            })}

            {/* Note info */}
            <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/60 flex items-start gap-2.5 mt-4">
              <span className="text-base leading-none">💡</span>
              <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                يمكنك دائماً تغيير مدينتك في أي وقت من القائمة الجانبية للتطبيق للتبديل بين السيرفرات والمناطق.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CitySelectionModal;

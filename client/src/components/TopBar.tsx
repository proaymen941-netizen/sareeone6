import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { 
  ShoppingCart, 
  Heart, 
  User, 
  Search,
  Menu as MenuIcon,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUiSettings } from '@/context/UiSettingsContext';
import { getAppStatus } from '../utils/restaurantHours';
import { CustomerNotificationsPanel } from './CustomerNotificationsPanel';
import waselLogo from '@assets/wasel-logo.png';

// شريط حالة عمل التطبيق (مفتوح/مغلق + ساعات العمل) - استبدل زر الموقع
const WorkingHoursIndicator: React.FC = () => {
  const { getSetting } = useUiSettings();
  const { t, language } = useLanguage();
  const storeStatus = getSetting('store_status') || 'auto';
  const openingTime = getSetting('opening_time') || '08:00';
  const closingTime = getSetting('closing_time') || '23:00';
  const storeEmergencyClosed = getSetting('store_emergency_closed', 'false');
  const emergencyMessage = getSetting('store_emergency_message', '');
  const workingDays = getSetting('working_days', '0,1,2,3,4,5,6');

  const computeStatus = () => {
    return getAppStatus(
      openingTime,
      closingTime,
      storeStatus,
      storeEmergencyClosed,
      emergencyMessage,
      workingDays
    );
  };

  const [appStatus, setAppStatus] = React.useState(computeStatus);

  React.useEffect(() => {
    setAppStatus(computeStatus());
    const t = setInterval(() => setAppStatus(computeStatus()), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeStatus, openingTime, closingTime, storeEmergencyClosed, emergencyMessage, workingDays]);

  const isOpen = appStatus.isOpen;

  // تنسيق 12 ساعة مع ص/م بالعربية أو AM/PM بالإنجليزية
  const format12 = (timeStr: string): string => {
    if (!timeStr || !timeStr.includes(':')) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = (mStr || '00').padStart(2, '0');
    if (isNaN(h)) return timeStr;
    const suffix = language === 'ar' ? (h >= 12 ? 'م' : 'ص') : (h >= 12 ? 'PM' : 'AM');
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${suffix}`;
  };

  return (
    <div className="relative px-3 pb-2.5">
      <div
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-sm border transition-colors ${
          isOpen
            ? 'bg-green-500/10 border-green-400/30'
            : 'bg-red-500/10 border-red-400/30'
        }`}
        data-testid="indicator-working-hours"
      >
        <div className="relative">
          <span
            className={`absolute inset-0 rounded-full ${
              isOpen ? 'bg-green-400 animate-ping' : 'bg-red-400'
            } opacity-60`}
          />
          <span
            className={`relative block w-2.5 h-2.5 rounded-full ${
              isOpen ? 'bg-green-400' : 'bg-red-400'
            }`}
          />
        </div>
        <Clock className={`h-3.5 w-3.5 ${isOpen ? 'text-green-300' : 'text-red-300'}`} />
        <div className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          <div className="text-[9px] font-bold text-white/60 leading-none">
            {isOpen ? t('app_open_now') : t('app_closed_now')}
          </div>
          <div className="text-xs font-bold text-white truncate leading-tight mt-0.5">
            {t('working_hours')}: {format12(openingTime)} - {format12(closingTime)}
          </div>
        </div>
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
            isOpen
              ? 'bg-green-400/20 text-green-300 border border-green-400/30'
              : 'bg-red-400/20 text-red-300 border border-red-400/30'
          }`}
        >
          {isOpen ? t('open') : t('closed')}
        </span>
      </div>
    </div>
  );
};

export const TopBar: React.FC = () => {
  const [, setLocation] = useLocation();
  const { state } = useCart();
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { toast } = useToast();
  const { getSetting, loading: settingsLoading } = useUiSettings();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const logoUrl = getSetting('header_logo_url') || getSetting('logo_url') || waselLogo;
  const appName = getSetting('app_name') || 'السريع ون';
  const appSubtitle = getSetting('app_subtitle') || 'السريع ون';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
    }
  };

  const handleOpenCart = () => {
    window.dispatchEvent(new CustomEvent('openCart'));
  };

  const getItemCount = () => state.items.reduce((sum, item) => sum + item.quantity, 0);

  const Logo = () => (
    <div 
      className="cursor-pointer shrink-0"
      onClick={() => setLocation('/')}
    >
      {settingsLoading ? (
        <div className="h-10 md:h-16 w-24 bg-gray-100 animate-pulse rounded-lg" />
      ) : logoUrl ? (
        <img src={logoUrl} alt={appName} className="h-10 md:h-16 w-auto object-contain" />
      ) : (
        <div className="text-2xl md:text-4xl font-black tracking-tighter select-none text-white">
          {appName}
        </div>
      )}
    </div>
  );

  return (
    <div className="sticky top-0 z-50">
      {/* Desktop Header - orange-red gradient */}
      <div className="bg-gradient-to-r from-[#E64A19] via-[#FF5722] to-[#F4511E] border-b border-white/10 hidden md:block shadow-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-8">
          <div 
            className="cursor-pointer shrink-0 flex items-center gap-3 group"
            onClick={() => setLocation('/')}
            data-testid="link-home-logo"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity" />
              <img src={logoUrl} alt={appName} className="relative h-12 w-auto object-contain transition-transform group-hover:scale-105 drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)]" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black text-white tracking-tight drop-shadow-sm">{appName}</span>
              <span className="text-[11px] font-bold text-white/90 tracking-[0.2em] mt-1">{appSubtitle}</span>
            </div>
          </div>

          <div className="flex-1 max-w-2xl">
            <form onSubmit={handleSearch} className="relative group">
              <Input 
                className="w-full pr-12 pl-4 h-12 bg-white/95 border-0 focus:bg-white rounded-2xl shadow-sm transition-all text-base font-bold text-slate-800 placeholder-slate-400"
                placeholder={t('search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-primary hover:scale-110 transition-transform">
                <Search className="h-6 w-6" />
              </button>
            </form>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLocation(user ? '/profile' : '/auth')}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all active:scale-95 relative"
            >
              <User className="h-6 w-6 text-white" />
            </button>
            
            <button 
              onClick={() => setLocation('/favorites')}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all active:scale-95 relative"
            >
              <Heart className="h-6 w-6 text-white" />
            </button>

            <button 
              onClick={handleOpenCart}
              className="p-2.5 bg-white text-[#FF5722] hover:bg-white/90 rounded-2xl transition-all active:scale-95 relative shadow-md"
            >
              <div className="relative">
                <ShoppingCart className="h-6 w-6" />
                {getItemCount() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#1E2022] text-white text-[10px] rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center font-black border-2 border-white shadow-sm">
                    {getItemCount()}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header - orange-red gradient with curved bottom */}
      <div className="md:hidden relative bg-gradient-to-b from-[#FF5722] via-[#F4511E] to-[#E64A19] shadow-xl overflow-hidden rounded-b-[24px]">
        {/* Decorative subtle circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-black/5 blur-xl pointer-events-none" />

        <div className="relative px-3.5 py-3 flex items-center justify-between gap-2">
          {/* Right side (RTL leading): Menu + Notifications */}
          <div className="flex items-center gap-1.5">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 text-white bg-white/15 hover:bg-white/25 shrink-0 rounded-2xl active:scale-95 transition-transform" 
              onClick={() => document.getElementById('sidebar-trigger')?.click()}
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
            <CustomerNotificationsPanel />
          </div>

          {/* Center: Brand pill with logo + name */}
          <div 
            className="flex-1 flex items-center justify-center cursor-pointer"
            onClick={() => setLocation('/')}
            data-testid="link-home-logo-mobile"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-md shadow-inner">
              <div className="relative">
                <img src={logoUrl} alt={appName} className="relative h-7 w-7 object-contain drop-shadow" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-white font-black text-sm tracking-tight">{appName}</span>
                <span className="text-[8px] font-bold text-white/90 tracking-wider mt-0.5">{appSubtitle}</span>
              </div>
            </div>
          </div>

          {/* Left side (RTL trailing): Search + Cart */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="h-10 w-10 flex items-center justify-center text-white bg-white/15 hover:bg-white/25 rounded-2xl transition-all active:scale-95"
              aria-label="search"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={handleOpenCart}
              className="h-10 w-10 flex items-center justify-center text-[#FF5722] bg-white hover:bg-white/90 rounded-2xl transition-all active:scale-95 relative shadow-md"
              aria-label="cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {getItemCount() > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#1E2022] text-white text-[9px] rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center font-black border border-white shadow-sm">
                  {getItemCount()}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Working Hours Indicator */}
        <WorkingHoursIndicator />

        {/* Mobile Search Bar - Expandable */}
        {isSearchOpen && (
          <div className="relative px-3.5 pb-3.5 pt-1">
            <form onSubmit={handleSearch} className="relative">
              <input
                autoFocus
                className="w-full bg-white text-slate-900 placeholder-slate-400 border-0 rounded-2xl px-4 py-2.5 pr-11 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white shadow-md"
                placeholder={t('search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[#FF5722] text-white flex items-center justify-center shadow">
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;

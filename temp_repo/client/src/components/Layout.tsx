import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Home, 
  Receipt, 
  User, 
  Settings, 
  Shield, 
  ShoppingCart,
  Heart,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  Share2,
  MessageCircle,
  X,
  Globe,
  MapPin,
  Building2,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import CartButton from './CartButton';
import { useToast } from '@/hooks/use-toast';
import { useUiSettings } from '@/context/UiSettingsContext';
import { useLanguage } from '../context/LanguageContext';
import TopBar from './TopBar';
import Navbar from './Navbar';
import AppClosedOverlay from './AppClosedOverlay';
import ChatOverlay from './ChatOverlay';
import { getAppStatus } from '../utils/restaurantHours';
import CitySelectionModal from './CitySelectionModal';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { state } = useCart();
  const { user } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const getItemCount = () => state.items.reduce((sum, item) => sum + item.quantity, 0);
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [adminChatOpen, setAdminChatOpen] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const { getSetting } = useUiSettings();

  const isCitySelectionEnabled = getSetting('enable_city_selection') === 'true';
  const defaultCityName = getSetting('current_city_name') || 'تعز';
  const [currentSelectedCity, setCurrentSelectedCity] = useState<string>(() => {
    return localStorage.getItem('selected_city_name') || defaultCityName;
  });

  useEffect(() => {
    const handleCityChange = (e: any) => {
      const cityName = e.detail?.name || localStorage.getItem('selected_city_name') || defaultCityName;
      setCurrentSelectedCity(cityName);
    };
    window.addEventListener('cityChanged', handleCityChange);
    window.addEventListener('storage', handleCityChange);
    return () => {
      window.removeEventListener('cityChanged', handleCityChange);
      window.removeEventListener('storage', handleCityChange);
    };
  }, [defaultCityName]);

  const appStatus = (() => {
    const openingTime = getSetting('opening_time') || '08:00';
    const closingTime = getSetting('closing_time') || '23:00';
    const storeStatus = getSetting('store_status') || 'auto';
    const storeEmergencyClosed = getSetting('store_emergency_closed', 'false');
    const emergencyMessage = getSetting('store_emergency_message', '');
    const workingDays = getSetting('working_days', '0,1,2,3,4,5,6');
    return getAppStatus(openingTime, closingTime, storeStatus, storeEmergencyClosed, emergencyMessage, workingDays);
  })();

  const getS = (key: string, defaultValue: string) => getSetting(key) || defaultValue;

  const rawWa = getS('support_whatsapp', '967777146387').replace(/[^0-9]/g, '');
  const whatsappLink = rawWa.startsWith('967') ? `https://wa.me/${rawWa}` : `https://wa.me/967${rawWa}`;
  const rawPhone = getS('support_phone', '967777146387').replace(/[^0-9]/g, '');
  const phoneLink = `tel:+${rawPhone}`;
  const shareText = language === 'ar' ? getS('share_text', 'تسوق من السريع ون الآن!') : 'Shop from Saree One now!';
  const shareUrl = getS('share_url', window.location.origin);
  const headerLogoUrl = getS('header_logo_url', '');
  const sidebarLogoUrl = getS('sidebar_logo_url', '') || headerLogoUrl;
  const appName = getS('app_name', 'السريع ون');
  const appSubtitle = getS('app_subtitle', 'السريع ون');
  const appVersion = getS('app_version', '1.0.0');
  const sidebarTagline = language === 'ar' ? getS('sidebar_tagline', 'خدمة التوصيل الأسرع في المملكة') : t('app_tagline');
  const supportTitle = language === 'ar' ? getS('text_support_title', 'نحن معك..') : t('support_title');

  const showShareButton = getSetting('show_share_button') !== 'false';
  const showContactButton = getSetting('show_contact_button') !== 'false';
  const showPrivacyButton = getSetting('show_privacy_button') !== 'false';
  const bottomBarEnabled = getSetting('bottom_bar_enabled') !== 'false';

  const isAdminPage = location.startsWith('/admin');
  const isDeliveryPage = location.startsWith('/delivery');
  const isDriverPage = location.startsWith('/driver');

  if (isAdminPage || isDeliveryPage || isDriverPage) {
    return <>{children}</>;
  }

  const sidebarMenuItems = [
    { icon: Heart, label: t('favorites'), path: '/favorites' },
    { icon: User, label: t('my_account'), path: user ? '/profile' : '/auth' },
    { icon: Settings, label: t('settings'), path: '/settings' },
    ...(showPrivacyButton ? [{ icon: Shield, label: t('privacy_policy'), path: '/privacy' }] : []),
  ];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: appName,
        text: shareText,
        url: shareUrl,
      }).catch(console.error);
    } else {
      toast({
        title: t('copied'),
        description: t('copied_desc'),
      });
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const navigate = (path: string) => {
    setLocation(path);
    setSidebarOpen(false);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className="bg-background min-h-screen flex flex-col pb-16 md:pb-0" dir={dir}>
      <TopBar />
      {location !== '/' && !location.startsWith('/restaurant/') && <Navbar />}

      {/* App Closed Overlay - يظهر فقط عند تفعيل الإغلاق الطارئ */}
      {appStatus.isEmergencyClosed && (
        <AppClosedOverlay
          openingTime={appStatus.openingTime}
          message={appStatus.message || (language === 'ar' ? "عذراً لا تستطيع الطلب الآن لأن التطبيق مغلق بصفة طارئة" : "Sorry, orders are temporarily closed at the moment")}
          onClose={() => {}}
          scheduledOrdersEnabled={getSetting('allow_scheduled_orders_when_closed') !== 'false'}
        />
      )}

      {/* Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <button id="sidebar-trigger" className="hidden" />
        </SheetTrigger>
        <SheetContent side={language === 'ar' ? 'right' : 'left'} className="w-[320px] p-0 flex flex-col border-none shadow-2xl bg-gradient-to-b from-slate-50 to-white">

          {/* Hero header: orange gradient */}
          <div className="relative bg-gradient-to-b from-[#FF5722] via-[#F4511E] to-[#E64A19] px-5 pt-8 pb-14 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-6 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/5 blur-xl pointer-events-none" />

            <button
              onClick={() => setSidebarOpen(false)}
              className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'} z-10 p-2 text-white/90 hover:text-white hover:bg-white/15 rounded-full transition-colors active:scale-95`}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Logo + brand */}
            <div className="relative flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                {sidebarLogoUrl ? (
                  <img src={sidebarLogoUrl} alt={appName} className="relative h-14 w-14 object-contain drop-shadow-md" />
                ) : (
                  <div className="relative h-14 w-14 flex items-center justify-center rounded-2xl bg-white/20 text-2xl font-black text-white shadow-inner">
                    {appName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-2xl font-black text-white tracking-tight drop-shadow-sm">{appName}</span>
                <span className="text-[10px] font-bold text-white/90 tracking-wider mt-1">{appSubtitle}</span>
              </div>
            </div>

            <p className="relative text-center text-xs font-bold text-white/80 leading-snug px-4">
              {sidebarTagline}
            </p>
          </div>

          {/* Profile card - overlaps the header */}
          <div className="relative -mt-8 px-5 z-10">
            <button
              onClick={() => navigate(user ? '/profile' : '/auth')}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-orange-100 shadow-[0_8px_20px_-4px_rgba(255,87,34,0.12)] hover:shadow-[0_12px_28px_-4px_rgba(255,87,34,0.2)] transition-all active:scale-[0.99]"
              data-testid="button-profile-card"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6E40] to-[#FF5722] flex items-center justify-center text-white font-black text-lg shadow-sm flex-shrink-0">
                {user ? (user.name?.charAt(0) || user.phone?.charAt(0) || 'U') : <User className="h-6 w-6" />}
              </div>
              <div className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'} min-w-0`}>
                <p className="text-sm font-black text-slate-900 truncate">
                  {user ? (user.name || t('welcome')) : t('sign_in')}
                </p>
                <p className="text-[11px] font-bold text-slate-400 truncate">
                  {user?.phone || t('guest_sign_in_hint')}
                </p>
              </div>
              {language === 'ar' ? <ChevronLeft className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4">
            <p className="px-2 mb-2 text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase">
              {t('menu')}
            </p>
            <div className="space-y-1">
              {sidebarMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-l from-[#F05215]/15 to-transparent ring-1 ring-[#F05215]/30'
                        : 'hover:bg-slate-50'
                    }`}
                    data-testid={`link-sidebar-${item.path.replace('/', '')}`}
                  >
                    <div className={`w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors ${
                      isActive
                        ? 'bg-gradient-to-br from-[#F05215] to-[#FF7840] text-white shadow-md'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className={`text-sm flex-1 ${language === 'ar' ? 'text-right' : 'text-left'} ${isActive ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F05215]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="my-4 h-px bg-slate-100" />

            <p className="px-2 mb-2 text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase">
              {t('preferences')}
            </p>

            {/* City Selection Toggle / Change City */}
            {isCitySelectionEnabled && (
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  setCityModalOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 hover:bg-orange-50/90 bg-gradient-to-r from-orange-50/70 to-amber-50/40 border border-orange-200/80 mb-2 shadow-xs group"
                data-testid="button-change-city"
              >
                <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 bg-gradient-to-br from-[#F05215] to-[#FF7840] text-white shadow-xs group-hover:scale-105 transition-transform">
                  <MapPin className="h-4.5 w-4.5" />
                </div>
                <div className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                    {language === 'ar' ? 'المدينة:' : 'City:'} <span className="text-[#F05215]">{currentSelectedCity}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                    {language === 'ar' ? 'اضغط لتغيير السيرفر والمدينة' : 'Switch city & server'}
                  </span>
                </div>
                <span className="text-[10px] font-black bg-[#F05215] text-white px-2.5 py-1 rounded-lg shadow-xs">
                  {language === 'ar' ? 'تغيير' : 'Change'}
                </span>
              </button>
            )}

            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-slate-50"
              data-testid="button-toggle-language"
            >
              <div className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 bg-slate-100 text-slate-600">
                <Globe className="h-4.5 w-4.5" />
              </div>
              <div className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <span className="text-sm font-bold text-slate-700 block">
                  {language === 'ar' ? 'اللغة: العربية' : 'Language: English'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {language === 'ar' ? 'التبديل إلى English' : 'Switch to العربية'}
                </span>
              </div>
              <span className="text-[11px] font-black bg-[#F05215]/15 text-[#F05215] px-2.5 py-1 rounded-xl">
                {language === 'ar' ? 'EN' : 'عربي'}
              </span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-center gap-3 mb-3">
              {showShareButton && (
                <button
                  onClick={handleShare}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white border border-slate-200 hover:border-[#F05215]/40 hover:bg-[#F05215]/5 shadow-sm transition-all"
                  data-testid="button-share"
                >
                  <Share2 className="h-4.5 w-4.5 text-slate-600" />
                </button>
              )}
              {showContactButton && (
                <button
                  onClick={() => { setSidebarOpen(false); setSupportOpen(true); }}
                  className="flex-1 max-w-[180px] h-11 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F05215] to-[#FF7840] text-white font-black text-sm shadow-md hover:shadow-lg transition-all"
                  data-testid="button-contact-support"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t('contact_us')}
                </button>
              )}
            </div>
            <p className="text-[10px] text-center text-slate-400 font-bold tracking-[0.3em]">
              {appName} · V{appVersion}
            </p>
          </div>

        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {bottomBarEnabled && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t z-50 md:hidden flex items-center justify-around h-16 px-4 pb-1 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <button
            onClick={() => setLocation('/')}
            className={`flex flex-col items-center gap-0.5 transition-all duration-300 min-w-[52px] ${location === '/' ? 'text-primary scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Home className={`h-6 w-6 ${location === '/' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-black">{t('home')}</span>
            {location === '/' && <div className="h-1 w-4 bg-primary rounded-full" />}
          </button>

          <button
            onClick={() => setLocation('/orders')}
            className={`flex flex-col items-center gap-0.5 transition-all duration-300 min-w-[52px] ${location === '/orders' ? 'text-primary scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Receipt className={`h-6 w-6 ${location === '/orders' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-black">{t('orders')}</span>
            {location === '/orders' && <div className="h-1 w-4 bg-primary rounded-full" />}
          </button>

          {/* Support Center Button */}
          <div className="relative -mt-8">
            <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
              <DialogTrigger asChild>
                <button className="flex flex-col items-center group">
                  <div className="header-gradient text-white p-4 rounded-2xl shadow-lg shadow-primary/30 border-4 border-white transform transition-transform group-hover:scale-110 active:scale-95">
                    <MessageCircle className="h-7 w-7" />
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-t-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
                <DialogTitle className="sr-only">{supportTitle}</DialogTitle>
                <DialogDescription className="sr-only">{t('support_subtitle')}</DialogDescription>
                <div className="h-32 header-gradient p-8 flex items-end">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter">{supportTitle}</h2>
                </div>
                <div className="p-8 space-y-4">
                  <p className="text-gray-500 font-bold mb-6 text-center">{t('support_subtitle')}</p>
                  <div className="grid gap-4">
                    <Button
                      variant="outline"
                      className="h-20 flex items-center justify-between px-6 rounded-2xl border-2 border-orange-50 hover:bg-orange-50 hover:border-orange-200 group transition-all"
                      onClick={() => { window.open(whatsappLink, '_blank'); setSupportOpen(false); }}
                    >
                      <div className="bg-orange-100 p-3 rounded-xl group-hover:bg-orange-200 transition-colors">
                        <MessageCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div className={`flex-1 ${language === 'ar' ? 'text-right mr-4' : 'text-left ml-4'}`}>
                        <p className="font-black text-xl text-gray-900">{t('whatsapp')}</p>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('talk_directly')}</p>
                      </div>
                      {language === 'ar' ? <ChevronLeft className="h-5 w-5 text-gray-300" /> : <ChevronRight className="h-5 w-5 text-gray-300" />}
                    </Button>

                    <Button
                      variant="outline"
                      className="h-20 flex items-center justify-between px-6 rounded-2xl border-2 border-blue-50 hover:bg-blue-50 hover:border-blue-200 group transition-all"
                      onClick={() => { window.location.href = phoneLink; setSupportOpen(false); }}
                    >
                      <div className="bg-blue-100 p-3 rounded-xl group-hover:bg-blue-200 transition-colors">
                        <PhoneCall className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className={`flex-1 ${language === 'ar' ? 'text-right mr-4' : 'text-left ml-4'}`}>
                        <p className="font-black text-xl text-gray-900">{t('direct_call')}</p>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('instant_call')}</p>
                      </div>
                      {language === 'ar' ? <ChevronLeft className="h-5 w-5 text-gray-300" /> : <ChevronRight className="h-5 w-5 text-gray-300" />}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <button
            onClick={() => setLocation('/favorites')}
            className={`flex flex-col items-center gap-0.5 transition-all duration-300 min-w-[52px] ${location === '/favorites' ? 'text-primary scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Heart className={`h-6 w-6 ${location === '/favorites' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-black">{t('favorites')}</span>
            {location === '/favorites' && <div className="h-1 w-4 bg-primary rounded-full" />}
          </button>

          <button
            onClick={() => setLocation(user ? '/profile' : '/auth')}
            className={`flex flex-col items-center gap-0.5 transition-all duration-300 min-w-[52px] ${location === '/profile' ? 'text-primary scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <User className={`h-6 w-6 ${location === '/profile' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-black">{t('account')}</span>
            {location === '/profile' && <div className="h-1 w-4 bg-primary rounded-full" />}
          </button>
        </div>
      )}

      {/* Desktop Footer */}
      <footer className="hidden md:block bg-white border-t py-12 mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className={language === 'ar' ? 'text-right' : 'text-left'}>
            <div className="text-3xl font-black tracking-tighter mb-2 text-primary">
              {appName}
            </div>
            <p className="text-sm text-gray-500">{sidebarTagline}</p>
          </div>
          <div className={language === 'ar' ? 'text-right' : 'text-left'}>
            <h4 className="font-bold text-lg mb-4">{t('quick_links')}</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><button onClick={() => setLocation('/favorites')} className="hover:text-primary transition-colors">{t('favorites')}</button></li>
              <li><button onClick={() => setLocation('/orders')} className="hover:text-primary transition-colors">{t('orders')}</button></li>
              <li><button onClick={() => setLocation('/profile')} className="hover:text-primary transition-colors">{t('account')}</button></li>
              <li><button onClick={() => setLocation('/privacy')} className="hover:text-primary transition-colors">{t('privacy_policy')}</button></li>
            </ul>
          </div>
          <div className={language === 'ar' ? 'text-right' : 'text-left'}>
            <h4 className="font-bold text-lg mb-4">{t('contact_us')}</h4>
            <div className={`flex gap-3 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
              <button onClick={handleShare} className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                <Share2 className="h-5 w-5 text-gray-600" />
              </button>
              <button onClick={() => window.open(whatsappLink, '_blank')} className="p-2.5 bg-primary/10 hover:bg-primary/20 rounded-full transition-colors">
                <MessageCircle className="h-5 w-5 text-primary" />
              </button>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-8 pt-6 border-t text-center space-y-1">
          <p className="text-xs text-gray-500 font-bold">
            © 2026 {appName} · {t('all_rights_reserved')}
          </p>
          <a
            href="https://wa.me/967777146387"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-gray-500 hover:text-primary transition-colors font-medium underline underline-offset-2 cursor-pointer"
          >
            {language === 'ar' ? 'تصميم وبرمجة شركة اتقان سوفت' : 'Designed & Developed by ITQAN SOFT'}
          </a>
        </div>
      </footer>

      {/* Floating Cart Button & Modal Drawer (Available on Mobile and Web) */}
      <CartButton />

      {/* City Selection Modal */}
      <CitySelectionModal 
        isOpen={cityModalOpen} 
        onClose={() => setCityModalOpen(false)} 
      />

      {/* Floating Admin Chat Icon */}
      <div className="fixed bottom-24 left-6 z-[2000] md:bottom-8 md:left-8">
        <button
          onClick={() => {
            if (!user) {
              toast({
                title: language === 'ar' ? 'يجب تسجيل الدخول' : 'Login Required',
                description: language === 'ar' ? 'يرجى تسجيل الدخول لتتمكن من مراسلة الإدارة' : 'Please login to contact admin',
                variant: 'destructive',
              });
              setLocation('/auth');
              return;
            }
            setAdminChatOpen(true);
          }}
          className="w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 border-2 border-white"
          title={language === 'ar' ? 'مراسلة الإدارة' : 'Contact Admin'}
        >
          <Bot className="h-8 w-8" />
        </button>
      </div>

      <ChatOverlay 
        isOpen={adminChatOpen} 
        onClose={() => setAdminChatOpen(false)} 
        userType="customer"
      />
    </div>
  );
}

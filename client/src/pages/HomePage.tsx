import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  Star, 
  Heart,
  UtensilsCrossed,
  Menu,
  Tag,
  Clock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUiSettings } from '@/context/UiSettingsContext';
import { useUserLocation } from '@/context/LocationContext';
import { useLanguage } from '@/context/LanguageContext';
import type { Category, Restaurant, SpecialOffer } from '@shared/schema';
import { getRestaurantStatus, getAppStatus } from '@/utils/restaurantHours';

// ─── Haversine distance (km) ─────────────────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number, language: string): string {
  if (!km || isNaN(km)) return language === 'ar' ? '0 كم' : '0 km';
  if (km < 1) return language === 'ar' ? `${Math.round(km * 1000)} م` : `${Math.round(km * 1000)} m`;
  return language === 'ar' ? `${(Number(km) || 0).toFixed(1)} كم` : `${(Number(km) || 0).toFixed(1)} km`;
}

// ─── localStorage favorites ───────────────────────────────────────────────────
const FAV_KEY = 'restaurant_favorites';
function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function saveFavorites(set: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTab, setSelectedTab] = useState('all');
  const { getSetting } = useUiSettings();
  const { location: userLocation } = useUserLocation();
  const { t, language } = useLanguage();

  // ── Offer slider state ────────────────────────────────────────────────────
  const [offerIndex, setOfferIndex] = useState(0);
  const sliderTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restaurant favorites ──────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);

  const getS = (key: string, defaultValue: string) => getSetting(key) || defaultValue;
  const showSection = (key: string) => getSetting(key) !== 'false';

  const appStatus = useMemo(() => {
    const openingTime = getSetting('opening_time') || '08:00';
    const closingTime = getSetting('closing_time') || '23:00';
    const storeStatus = getSetting('store_status') || 'open';
    return getAppStatus(openingTime, closingTime, storeStatus);
  }, [getSetting]);

  const { data: restaurants } = useQuery<Restaurant[]>({ queryKey: ['/api/restaurants'] });
  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });
  const { data: offers } = useQuery<SpecialOffer[]>({ queryKey: ['/api/special-offers'] });

  const activeOffers = (offers || []).filter(o => o.isActive);

  // ── Auto-slide offers ─────────────────────────────────────────────────────
  const startSlider = useCallback(() => {
    if (sliderTimer.current) clearInterval(sliderTimer.current);
    if (activeOffers.length > 1) {
      sliderTimer.current = setInterval(() => {
        setOfferIndex(prev => (prev + 1) % activeOffers.length);
      }, 4000);
    }
  }, [activeOffers.length]);

  useEffect(() => {
    startSlider();
    return () => { if (sliderTimer.current) clearInterval(sliderTimer.current); };
  }, [startSlider]);

  const prevOffer = () => {
    setOfferIndex(prev => (prev - 1 + activeOffers.length) % activeOffers.length);
    startSlider();
  };
  const nextOffer = () => {
    setOfferIndex(prev => (prev + 1) % activeOffers.length);
    startSlider();
  };

  // ── Toggle restaurant favorite ────────────────────────────────────────────
  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  };

  // ── Filter & sort restaurants ─────────────────────────────────────────────
  const userLat = userLocation.position?.coords.latitude;
  const userLng = userLocation.position?.coords.longitude;

  const filteredRestaurants = (() => {
    let list = (restaurants || []).filter(r => {
      if (selectedCategory !== 'all' && r.categoryId !== selectedCategory) return false;
      if (selectedTab === 'newest' && !r.isNew) return false;
      if (selectedTab === 'favorites' && !favorites.has(r.id)) return false;
      return true;
    });

    if (selectedTab === 'nearest') {
      if (userLat && userLng) {
        list = list
          .map(r => ({
            ...r,
            _dist:
              r.latitude && r.longitude
                ? haversineDistance(userLat, userLng, parseFloat(String(r.latitude)), parseFloat(String(r.longitude)))
                : Infinity,
          }))
          .sort((a: any, b: any) => a._dist - b._dist);
      }
    }
    return list;
  })();

  const tabs = [
    { key: 'all',       label: language === 'ar' ? getS('btn_tab_all', 'الكل') : 'All' },
    { key: 'nearest',   label: language === 'ar' ? getS('btn_tab_nearest', 'الأقرب') : 'Nearest' },
    { key: 'newest',    label: language === 'ar' ? getS('btn_tab_new', 'الجديدة') : 'New' },
    { key: 'favorites', label: language === 'ar' ? getS('btn_tab_favorites', 'المفضلة') : t('favorites') },
  ];

  const currentOffer = activeOffers[offerIndex];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Categories ─────────────────────────────────────────────────────── */}
      {showSection('show_categories') && (
        <div className="bg-white border-b border-orange-100/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="flex overflow-x-auto no-scrollbar px-4 py-3.5 gap-3.5 items-center">
            <div
              className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 min-w-[68px] group"
              onClick={() => { setSelectedCategory('all'); setSelectedTab('all'); }}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-200 ${
                selectedCategory === 'all' 
                  ? 'border-[#FF5722] bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-md shadow-orange-500/15 scale-105' 
                  : 'bg-slate-50 border-slate-100 group-hover:bg-orange-50/40'
              }`}>
                <Menu className={`h-6 w-6 transition-transform group-hover:scale-110 ${selectedCategory === 'all' ? 'text-[#FF5722]' : 'text-slate-600'}`} />
              </div>
              <span className={`text-[11px] font-bold text-center leading-tight transition-colors ${selectedCategory === 'all' ? 'text-[#FF5722] font-black' : 'text-slate-700'}`}>
                {language === 'ar' ? getS('text_all_categories', 'كل التصنيفات') : t('all_categories')}
              </span>
            </div>

            {/* خدمة وصل لي في شريط التصنيفات */}
            {showSection('show_wasalni_service') && (
              <div
                className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 min-w-[68px] group"
                onClick={() => setLocation('/wasalni')}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 bg-gradient-to-br from-[#FF6E40] to-[#FF5722] border-transparent shadow-md shadow-orange-500/20 group-hover:scale-105 transition-all">
                  <span className="text-2xl drop-shadow-sm">🛵</span>
                </div>
                <span className="text-[11px] font-black text-center leading-tight text-[#FF5722]">
                  {language === 'ar' ? getS('wasalni_service_name', 'وصل لي') : 'Wasalni'}
                </span>
              </div>
            )}

            {categories?.filter(c => c.isActive !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(cat => (
              <div
                key={cat.id}
                className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0 min-w-[68px] group"
                onClick={() => { setSelectedCategory(cat.id); setSelectedTab('all'); }}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-200 overflow-hidden ${
                  selectedCategory === cat.id 
                    ? 'border-[#FF5722] bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-md shadow-orange-500/15 scale-105' 
                    : 'bg-slate-50 border-slate-100 group-hover:bg-orange-50/40'
                }`}>
                  {cat.image
                    ? <img src={cat.image} alt={cat.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    : cat.icon
                      ? <i className={`${cat.icon} text-2xl ${selectedCategory === cat.id ? 'text-[#FF5722]' : 'text-slate-500'}`} />
                      : <UtensilsCrossed className={`h-6 w-6 ${selectedCategory === cat.id ? 'text-[#FF5722]' : 'text-slate-500'}`} />
                  }
                </div>
                <span className={`text-[11px] font-bold text-center leading-tight transition-colors ${selectedCategory === cat.id ? 'text-[#FF5722] font-black' : 'text-slate-700'}`}>
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Offers Slider ───────────────────────────────────────────────────── */}
      {showSection('show_hero_section') && activeOffers.length > 0 && currentOffer && (
        <div className="px-4 pt-4 pb-2">
          <div className="relative w-full rounded-3xl overflow-hidden shadow-lg border border-orange-100/60" style={{ height: activeOffers.length === 1 ? '200px' : '185px' }}>
              {/* Image */}
              {currentOffer.image
                ? <img src={currentOffer.image} alt={currentOffer.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-[#FF5722] via-[#F4511E] to-[#D84315]" />
              }

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

              {/* Badge top */}
              {currentOffer.showBadge !== false && (
                <div className={`absolute top-3.5 ${language === 'ar' ? 'right-3.5' : 'left-3.5'} flex gap-1.5`}>
                  <span className="bg-[#FF5722] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">
                    {currentOffer.badgeText1 || (language === 'ar' ? 'عرض خاص' : 'Special Offer')}
                  </span>
                  {currentOffer.badgeText2 && (
                    <span className="bg-white/25 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full">
                      {currentOffer.badgeText2}
                    </span>
                  )}
                </div>
              )}

              {/* Content bottom */}
              <div className={`absolute bottom-0 right-0 left-0 p-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <h3 className="text-white font-black text-base leading-snug line-clamp-2 mb-1 drop-shadow">
                  {currentOffer.title}
                </h3>
                {currentOffer.description && (
                  <p className="text-white/90 text-xs line-clamp-1 mb-2.5 font-medium">
                    {currentOffer.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <button
                    className="bg-white text-[#FF5722] hover:bg-orange-50 text-xs font-black px-4 py-2 rounded-2xl flex items-center gap-1 shadow-md transition-all active:scale-95"
                    onClick={() => {
                      if (currentOffer.restaurantId) {
                        setLocation(`/restaurant/${currentOffer.restaurantId}`);
                      } else if (currentOffer.menuItemId) {
                        setLocation(`/category/العروض#product-${currentOffer.menuItemId}`);
                      } else {
                        setLocation('/category/العروض');
                      }
                    }}
                  >
                    {language === 'ar' ? getS('btn_shop_now', 'تسوق الآن') : t('shop_now')}
                    {language === 'ar' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {(currentOffer.discountPercent || currentOffer.discountAmount) && (
                    <span className="bg-[#FF5722] text-white text-[11px] font-black px-3 py-1 rounded-full shadow-sm">
                      {currentOffer.discountPercent
                        ? (language === 'ar' ? `خصم ${currentOffer.discountPercent}%` : `${currentOffer.discountPercent}% OFF`)
                        : (language === 'ar' ? `خصم ${currentOffer.discountAmount} ر.ي` : `${currentOffer.discountAmount} YER OFF`)}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrows — only when multiple offers */}
              {activeOffers.length > 1 && (
                <>
                  <button
                    onClick={nextOffer}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-all backdrop-blur-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={prevOffer}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-all backdrop-blur-sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  {/* Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {activeOffers.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setOfferIndex(i); startSlider(); }}
                        className={`rounded-full transition-all ${i === offerIndex ? 'w-5 h-1.5 bg-white shadow' : 'w-1.5 h-1.5 bg-white/50'}`}
                      />
                    ))}
                  </div>

                  {/* كل العروض */}
                  <button
                    className={`absolute top-3.5 ${language === 'ar' ? 'left-3.5' : 'right-3.5'} text-white text-[10px] font-bold flex items-center gap-0.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full hover:bg-black/60 transition-all`}
                    onClick={() => setLocation('/category/العروض')}
                  >
                    {language === 'ar' ? 'كل العروض' : 'All Offers'}
                    {language === 'ar' ? <ChevronLeft className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                  </button>
                </>
              )}
            </div>
        </div>
      )}

      {/* ── Restaurant List ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-20">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-xs text-slate-500 font-bold bg-orange-50/80 px-2.5 py-1 rounded-full border border-orange-100">
            {filteredRestaurants.length} {language === 'ar' ? 'مطعم ومحل' : 'Stores & Restaurants'}
          </span>
          <span className="text-base font-black text-slate-900">
            {selectedCategory === 'all'
              ? (language === 'ar' ? 'جميع المطاعم والمحلات' : 'All Restaurants & Stores')
              : categories?.find(c => c.id === selectedCategory)?.name || (language === 'ar' ? 'المطاعم' : 'Restaurants')}
          </span>
        </div>

        {/* Nearest-tab: show location notice if no GPS */}
        {selectedTab === 'nearest' && !userLat && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 mb-3.5 text-right shadow-sm">
            <Navigation className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-800 font-bold">
              {language === 'ar' ? 'يرجى السماح بالوصول إلى موقعك لعرض الأقرب إليك' : 'Please allow location access to view nearby stores'}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-slate-100/90 p-1 rounded-2xl mb-4 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`flex-1 py-2.5 font-bold text-xs rounded-xl transition-all ${
                selectedTab === tab.key
                  ? 'bg-white text-[#FF5722] font-black shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setSelectedTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global app closed banner */}
        {!appStatus.isOpen && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-3.5 text-right shadow-sm">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 font-bold">
              {appStatus.message || (language === 'ar' ? 'التطبيق مغلق حالياً، نعود قريباً' : 'App is currently closed, back soon')}
            </p>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-3">
          {filteredRestaurants.map(restaurant => {
            const status = getRestaurantStatus(restaurant, appStatus.isOpen);
            const isFav = favorites.has(restaurant.id);
            const dist =
              userLat && userLng && restaurant.latitude && restaurant.longitude
                ? haversineDistance(userLat, userLng, parseFloat(String(restaurant.latitude)), parseFloat(String(restaurant.longitude)))
                : null;

            return (
              <div
                key={restaurant.id}
                className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-orange-100/60 overflow-hidden hover:shadow-[0_8px_24px_rgba(255,87,34,0.12)] transition-all cursor-pointer active:scale-[0.99]"
                onClick={() => setLocation(`/restaurant/${restaurant.id}`)}
              >
                <div className="flex items-center p-3.5 gap-3.5">
                  {/* Heart + Status badge */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <button
                      className={`p-1.5 rounded-full transition-colors ${isFav ? 'text-[#FF5722] bg-orange-50' : 'text-slate-300 hover:text-[#FF5722]'}`}
                      onClick={e => toggleFavorite(e, restaurant.id)}
                    >
                      <Heart className={`h-5 w-5 ${isFav ? 'fill-[#FF5722]' : ''}`} />
                    </button>
                    <Badge className={`text-[10px] font-black px-2 py-0.5 rounded-lg border-0 shadow-none ${
                      status.isOpen
                        ? status.statusColor === 'yellow' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-white'
                    }`}>
                      {status.isOpen ? t('open') : t('closed')}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 text-base leading-tight mb-0.5">
                      {restaurant.name}
                    </h4>
                    {restaurant.description && (
                      <p className="text-xs text-slate-500 leading-tight mb-1 truncate">{restaurant.description}</p>
                    )}
                    {restaurant.categoryId && (
                      <p className="text-xs text-slate-400 leading-tight mb-1 truncate">
                        {categories?.find(c => c.id === restaurant.categoryId)?.name || ''}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap mt-1">
                      {restaurant.deliveryTime && (
                        <span className="flex items-center gap-0.5 bg-slate-50 px-2 py-0.5 rounded-md">
                          <Clock className="h-3 w-3 text-slate-400" />{restaurant.deliveryTime} {t('delivery_time')}
                        </span>
                      )}
                      {restaurant.deliveryFee !== undefined && (
                        <span className="flex items-center gap-0.5 bg-slate-50 px-2 py-0.5 rounded-md font-bold">
                          <Tag className="h-3 w-3 text-slate-400" />{restaurant.deliveryFee} {t('currency')}
                        </span>
                      )}
                      {dist !== null && (
                        <span className="flex items-center gap-0.5 text-[#FF5722] font-bold bg-orange-50 px-2 py-0.5 rounded-md">
                          <MapPin className="h-3 w-3" />{formatDistance(dist, language)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Logo + Stars */}
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-orange-100/80 bg-orange-50/30 flex items-center justify-center shadow-inner">
                      {restaurant.image
                        ? <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                        : <UtensilsCrossed className="h-7 w-7 text-slate-300" />
                      }
                    </div>
                    <div className="flex items-center gap-1 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200/60 shadow-xs">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="text-[11px] font-black text-amber-950">
                        {parseFloat(restaurant.rating || '0') > 0 ? (Number(restaurant.rating) || 0).toFixed(1) : '5.0'}
                      </span>
                      <span className="text-[10px] font-bold text-amber-700/80">
                        ({restaurant.reviewCount || 0})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {filteredRestaurants.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {selectedTab === 'favorites'
                  ? <Heart className="h-10 w-10 text-gray-300" />
                  : selectedTab === 'nearest'
                    ? <Navigation className="h-10 w-10 text-gray-300" />
                    : <UtensilsCrossed className="h-10 w-10 text-gray-300" />
                }
              </div>
              <p className="text-gray-500 font-bold text-lg">
                {selectedTab === 'favorites'
                  ? (language === 'ar' ? 'لا توجد مفضلات بعد' : 'No favorites yet')
                  : selectedTab === 'nearest'
                    ? (language === 'ar' ? 'لا توجد محلات قريبة' : 'No nearby stores')
                    : (language === 'ar' ? 'لا توجد مطاعم متاحة' : 'No restaurants available')}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {selectedTab === 'favorites'
                  ? (language === 'ar' ? 'انقر على ♥ في أي مطعم لإضافته للمفضلة' : 'Tap ♥ on any restaurant to add to favorites')
                  : (language === 'ar' ? 'جرب تغيير التصنيف أو الفلتر' : 'Try changing category or filters')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

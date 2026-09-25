import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Heart, ArrowRight, Sparkles, ShoppingBag, Store, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MenuItemCard from '../components/MenuItemCard';
import type { MenuItem, Restaurant } from '@shared/schema';
import { useLocation } from 'wouter';
import { getLocalMealFavorites, syncLocalFavoritesToApi, getLocalFavoriteItems } from '@/lib/favorites';

export default function Favorites() {
  const { user, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Sync local favorites to backend when user is logged in
  useEffect(() => {
    if (user?.id) {
      syncLocalFavoritesToApi(user.id);
    }
  }, [user?.id]);

  const { data: stores } = useQuery<Restaurant[]>({
    queryKey: ['/api/restaurants'],
  });

  const { data: allProducts, isLoading: isProductsLoading } = useQuery<MenuItem[]>({
    queryKey: ['/api/products'],
  });

  const { data: apiFavoriteProducts, isLoading: isApiLoading } = useQuery<MenuItem[]>({
    queryKey: ['/api/favorites/products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const res = await fetch(`/api/favorites/products/${user.id}`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user?.id,
  });

  const displayFavorites = useMemo(() => {
    const localFavIds = getLocalMealFavorites();
    const localFavItems = getLocalFavoriteItems();
    const map = new Map<string, MenuItem>();

    // 1. Add locally cached favorite items
    for (const item of localFavItems) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }

    // 2. Add API favorites
    if (apiFavoriteProducts) {
      for (const item of apiFavoriteProducts) {
        if (item && item.id) {
          map.set(item.id, item);
        }
      }
    }

    // 3. Add local storage favorites from allProducts
    if (allProducts && localFavIds.length > 0) {
      for (const item of allProducts) {
        if (localFavIds.includes(item.id)) {
          map.set(item.id, item);
        }
      }
    }

    return Array.from(map.values());
  }, [apiFavoriteProducts, allProducts]);

  // Extract categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of displayFavorites) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats);
  }, [displayFavorites]);

  const filteredFavorites = useMemo(() => {
    if (selectedCategory === 'all') return displayFavorites;
    return displayFavorites.filter(item => item.category === selectedCategory);
  }, [displayFavorites, selectedCategory]);

  const isLoading = isProductsLoading || (isAuthenticated && isApiLoading);

  return (
    <div className="bg-gradient-to-b from-slate-50/70 via-white to-slate-50/50 min-h-screen pb-24" dir="rtl">
      <div className="container mx-auto px-4 py-6 md:py-10 max-w-7xl">
        
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-[#FF5722] via-[#F4511E] to-[#E64A19] rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/15 mb-8 relative overflow-hidden">
          {/* Background shapes */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-black/10 rounded-full blur-xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black">
                <Heart className="h-3.5 w-3.5 fill-white" />
                <span>قائمة المفضلات الشخصية</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {language === 'ar' ? 'وجباتك ومنتجاتك المفضلة' : 'My Favorite Items'}
              </h1>
              <p className="text-xs md:text-sm text-white/85 font-medium">
                {language === 'ar' 
                  ? 'جميع الوجبات والمنتجات التي قمت بحفظها لطلبها بسرعة وسهولة' 
                  : 'All the meals and items you saved for fast and easy ordering'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2.5 text-center border border-white/20">
                <span className="text-xl md:text-2xl font-black block leading-none">{displayFavorites.length}</span>
                <span className="text-[10px] font-bold text-white/80 uppercase">
                  {language === 'ar' ? 'عنصر محفوظ' : 'Saved items'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Category filters */}
        {categories.length > 1 && displayFavorites.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-[#F05215] text-white shadow-md shadow-orange-500/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              الكل ({displayFavorites.length})
            </button>
            {categories.map((cat) => {
              const count = displayFavorites.filter(item => item.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#F05215] text-white shadow-md shadow-orange-500/20'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse bg-white p-3 rounded-2xl border border-slate-100 shadow-xs space-y-3">
                <div className="aspect-square bg-slate-100 rounded-xl" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-6 bg-slate-100 rounded-lg w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredFavorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {filteredFavorites.map((item) => {
              const store = stores?.find(s => s.id === item.restaurantId);
              return (
                <MenuItemCard 
                  key={item.id} 
                  item={item} 
                  restaurantId={item.restaurantId || ''}
                  restaurantName={store?.name || 'متجر السريع ون'}
                />
              );
            })}
          </div>
        ) : displayFavorites.length > 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
            <p className="text-slate-500 text-sm font-bold mb-4">لا توجد منتجات في هذا التصنيف</p>
            <Button 
              onClick={() => setSelectedCategory('all')} 
              variant="outline" 
              className="rounded-2xl"
            >
              عرض جميع المفضلات
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-xl mx-auto">
            <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mb-4 text-[#F05215] shadow-xs">
              <Heart className="h-10 w-10 text-[#F05215]/40" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">
              {language === 'ar' ? 'قائمة مفضلاتك فارغة حالياً' : 'Your favorites list is empty'}
            </h3>
            <p className="text-slate-500 text-xs md:text-sm font-medium mb-6 max-w-sm leading-relaxed">
              {language === 'ar' 
                ? 'استكشف آلاف الوجبات والمنتجات اللذيذة واضغط على رمز القلب لحفظ وجباتك المفضلة والوصول إليها بسرعة.' 
                : 'Browse hundreds of delicious meals and tap the heart icon to save your favorites for fast access.'}
            </p>
            <Button 
              onClick={() => setLocation('/')} 
              className="bg-gradient-to-r from-[#F05215] to-[#FF7840] hover:from-[#E64A19] hover:to-[#F4511E] text-white font-bold rounded-2xl h-12 px-8 shadow-md shadow-orange-500/20"
            >
              <ShoppingBag className="h-4 w-4 ml-2" />
              {language === 'ar' ? 'تصفح المطاعم والمنتجات' : 'Explore Menu'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

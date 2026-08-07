import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MenuItemCard from '../components/MenuItemCard';
import type { MenuItem, Restaurant } from '@shared/schema';
import { useLocation } from 'wouter';
import { getLocalMealFavorites, syncLocalFavoritesToApi } from '@/lib/favorites';

export default function Favorites() {
  const { user, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();

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
      const res = await fetch(`/api/favorites/products/${user.id}`);
      if (!res.ok) throw new Error('Failed to fetch favorite products');
      return res.json();
    },
    enabled: !!user?.id,
  });

  const displayFavorites = useMemo(() => {
    const localFavIds = getLocalMealFavorites();
    const map = new Map<string, MenuItem>();

    // Add API favorites
    if (apiFavoriteProducts) {
      for (const item of apiFavoriteProducts) {
        map.set(item.id, item);
      }
    }

    // Add local storage favorites from allProducts
    if (allProducts && localFavIds.length > 0) {
      for (const item of allProducts) {
        if (localFavIds.includes(item.id)) {
          map.set(item.id, item);
        }
      }
    }

    return Array.from(map.values());
  }, [apiFavoriteProducts, allProducts]);

  const isLoading = isProductsLoading || (isAuthenticated && isApiLoading);

  return (
    <div className="bg-white min-h-screen pb-20" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter italic border-r-8 border-primary pr-4">
            {language === 'ar' ? 'قائمة المفضلات' : 'My Favorites'}
          </h1>
          <span className="text-sm font-bold text-gray-400 uppercase">{displayFavorites.length} {language === 'ar' ? 'منتج' : 'items'}</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse space-y-4">
                <div className="aspect-[3/4] bg-gray-100 rounded-none" />
                <div className="h-4 bg-gray-100 w-1/2" />
                <div className="h-4 bg-gray-100 w-3/4" />
              </div>
            ))}
          </div>
        ) : displayFavorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {displayFavorites.map((item) => {
              const store = stores?.find(s => s.id === item.restaurantId);
              return (
                <MenuItemCard 
                  key={item.id} 
                  item={item} 
                  restaurantId={item.restaurantId || ''}
                  restaurantName={store?.name || 'متجر'}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Heart className="h-12 w-12 text-gray-200" />
            </div>
            <h3 className="text-xl font-black mb-2 uppercase tracking-widest">{language === 'ar' ? 'لا توجد مفضلات' : 'No favorites yet'}</h3>
            <p className="text-gray-400 font-bold mb-8 max-w-xs">
              {language === 'ar' ? 'ابدأ بإضافة بعض المنتجات التي تعجبك إلى قائمة مفضلاتك' : 'Start adding some products you like to your favorites list'}
            </p>
            <Button 
              onClick={() => setLocation('/')} 
              variant="outline" 
              className="flex items-center gap-2 font-bold rounded-xl h-12 px-8 border-2"
            >
              {language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

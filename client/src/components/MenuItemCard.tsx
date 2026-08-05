import { Heart, Plus, ShoppingBag, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '../context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface MenuItemCardProps {
  item: any; // Supports MenuItem and Mapped SpecialOffer
  disabled?: boolean;
  disabledMessage?: string;
  restaurantId?: string;
  restaurantName?: string;
}

export default function MenuItemCard({ 
  item, 
  disabled = false, 
  disabledMessage, 
  restaurantId = 'unknown', 
  restaurantName = 'متجر غير محدد' 
}: MenuItemCardProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { isOnline } = useNetworkStatus();

  // Check if item is in favorites
  const { data: favoriteStatus } = useQuery<{ isFavorite: boolean }>({
    queryKey: ['/api/favorites/check', user?.id, item.id],
    queryFn: async () => {
      if (!user?.id || item.isBannerOffer) return { isFavorite: false };
      const res = await fetch(`/api/favorites/check?userId=${user.id}&menuItemId=${item.id}`);
      if (!res.ok) return { isFavorite: false };
      return res.json();
    },
    enabled: !!user?.id && !item.isBannerOffer,
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (item.isBannerOffer) return;
      if (!isAuthenticated) {
        throw new Error('not_authenticated');
      }
      if (!isOnline) {
        throw new Error('no_connection');
      }
      if (favoriteStatus?.isFavorite) {
        await apiRequest('DELETE', `/api/favorites?userId=${user?.id}&menuItemId=${item.id}`);
      } else {
        await apiRequest('POST', '/api/favorites', {
          userId: user?.id,
          menuItemId: item.id,
        });
      }
    },
    onSuccess: () => {
      if (item.isBannerOffer) return;
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/check', user?.id, item.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/products', user?.id] });
      
      toast({
        title: favoriteStatus?.isFavorite ? "تمت الإزالة من المفضلة" : "تمت الإضافة للمفضلة",
        description: favoriteStatus?.isFavorite ? `تمت إزالة ${item.name} من قائمة مفضلاتك` : `تم إضافة ${item.name} إلى قائمة مفضلاتك`,
      });
    },
    onError: (error: any) => {
      if (error?.message === 'not_authenticated') {
        toast({
          title: "يجب تسجيل الدخول",
          description: "يرجى إنشاء حساب أو تسجيل الدخول لإضافة المنتجات إلى المفضلة",
          variant: "destructive",
        });
        return;
      }
      if (error?.message === 'no_connection') {
        toast({
          title: "لا يوجد اتصال بالإنترنت",
          description: "يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "خطأ في المفضلة",
        description: "حدث خطأ أثناء تحديث المفضلة، يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (item.isBannerOffer) {
      if (item.menuItemId) {
        setLocation(`/product/${item.menuItemId}`);
      }
      return;
    }
    if (!isOnline) {
      toast({
        title: "لا يوجد اتصال بالإنترنت",
        description: "يرجى التحقق من اتصالك بالإنترنت لإضافة المنتجات",
        variant: "destructive",
      });
      return;
    }
    if (disabled && disabledMessage) {
      toast({
        title: "لا يمكن الطلب",
        description: disabledMessage,
        variant: "destructive",
      });
      return;
    }
    
    addItem(item, restaurantId, restaurantName);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.isBannerOffer) {
      toggleFavorite.mutate();
    }
  };

  const handleClick = () => {
    if (item.isBannerOffer) {
      if (item.menuItemId) {
        setLocation(`/product/${item.menuItemId}`);
      }
    } else {
      setLocation(`/product/${item.id}`);
    }
  };

  const discountPercent = item.originalPrice 
    ? Math.round((1 - parseFloat(String(item.price)) / parseFloat(String(item.originalPrice))) * 100)
    : 0;

  const isOutOfStock = item.isAvailable === false || item.inStock === false;

  return (
    <div 
      id={item.isBannerOffer ? `offer-${item.id}` : `product-${item.id}`}
      className="group relative bg-white cursor-pointer border border-slate-200/80 rounded-2xl overflow-hidden hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between h-full shadow-sm hover:-translate-y-1" 
      onClick={handleClick}
    >
      {/* Product Image Container */}
      <div className="relative aspect-[4/3] sm:aspect-square overflow-hidden bg-slate-50 w-full">
        <img
          src={item.image || '/placeholder-food.png'}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Badges Overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          {item.isBannerOffer && (
            <Badge className="bg-amber-500 text-white border-none rounded-lg text-[10px] sm:text-xs px-2 py-0.5 font-black shadow-sm">
              عرض خاص
            </Badge>
          )}
          {item.isFeatured && (
            <Badge className="bg-[#F05215] text-white border-none rounded-lg text-[10px] sm:text-xs px-2 py-0.5 font-black shadow-sm">
              مميز
            </Badge>
          )}
          {discountPercent > 0 && (
            <Badge className="bg-red-600 text-white border-none rounded-lg text-[10px] sm:text-xs px-2 py-0.5 font-black shadow-sm">
              خصم {discountPercent}%
            </Badge>
          )}
        </div>

        {/* Favorite Icon */}
        {!item.isBannerOffer && (
          <button 
            className="absolute top-2 left-2 p-2 bg-white/90 hover:bg-white text-gray-400 rounded-full transition-all shadow-md z-10 active:scale-90"
            onClick={handleToggleFavorite}
            disabled={toggleFavorite.isPending}
            aria-label="المفضلة"
          >
            <Heart className={`h-4 w-4 ${favoriteStatus?.isFavorite ? 'text-red-600 fill-current' : 'text-gray-400 hover:text-red-500'}`} />
          </button>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-20">
            <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg">
              غير متوفر حالياً
            </span>
          </div>
        )}
      </div>

      {/* Product Info & Action */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <h3 className="text-xs sm:text-sm md:text-base font-black text-slate-800 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-1 mt-1 font-medium">
              {item.description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {/* Rating & Sales */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-amber-400 bg-amber-50 px-2 py-0.5 rounded-md">
              <Star className="h-3 w-3 fill-current" />
              <span className="text-[10px] sm:text-xs font-black text-amber-800">{item.rating || '4.8'}</span>
            </div>
            {(item.salesCount !== undefined || item.isBannerOffer) && (
              <span className="text-[10px] sm:text-xs text-slate-400 font-bold">
                {item.isBannerOffer ? 'طلب مباشر' : `${item.salesCount || 0}+ طلب`}
              </span>
            )}
          </div>

          {/* Price & Add to Cart Button */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="text-sm sm:text-base md:text-lg font-black text-[#E03A0E]">
                  {item.price}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-500">ر.ي</span>
              </div>
              {item.originalPrice && (
                <span className="text-[10px] sm:text-xs text-slate-400 line-through font-semibold -mt-1">
                  {item.originalPrice} ر.ي
                </span>
              )}
            </div>

            <Button 
              size="sm"
              className="h-8 sm:h-9 px-2.5 sm:px-3 bg-gradient-to-r from-[#F05215] to-[#E03A0E] hover:from-[#E04205] hover:to-[#C73208] text-white font-black text-xs rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-1 active:scale-95 shrink-0"
              onClick={handleAddToCart}
              disabled={isOutOfStock || disabled}
              data-testid={`button-add-to-cart-${item.id}`}
            >
              {item.isBannerOffer ? (
                <>
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">عرض</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">أضف</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

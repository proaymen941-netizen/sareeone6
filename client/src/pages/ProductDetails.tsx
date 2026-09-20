import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronRight, 
  ChevronLeft,
  Star, 
  Heart, 
  Share2, 
  ShoppingBag, 
  Truck, 
  ShieldCheck, 
  Clock,
  Minus,
  Plus,
  Store,
  Check,
  Flame,
  Tag,
  MessageSquare,
  Sparkles,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useCart } from '../context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import { isLocalMealFavorite, toggleMealFavoriteWithApi } from '@/lib/favorites';
import type { MenuItem, Restaurant } from '@shared/schema';
import MenuItemCard from '@/components/MenuItemCard';

export default function ProductDetails() {
  const [, params] = useRoute('/product/:id');
  const [, setLocation] = useLocation();
  const { addItem, addNotes } = useCart();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Fetch Product details
  const { data: product, isLoading: isProductLoading } = useQuery<MenuItem>({
    queryKey: [`/api/products/${params?.id}`],
    enabled: !!params?.id,
  });

  // 2. Fetch Restaurant/Store info
  const { data: store } = useQuery<Restaurant>({
    queryKey: [`/api/restaurants/${product?.restaurantId}`],
    enabled: !!product?.restaurantId,
  });

  // 3. Check if product is in favorites
  const { data: favStatus } = useQuery<{ isFavorite: boolean }>({
    queryKey: ['/api/favorites/check', user?.id, params?.id],
    queryFn: async () => {
      if (!user?.id || !params?.id) return { isFavorite: false };
      const res = await fetch(`/api/favorites/check?userId=${user.id}&menuItemId=${params.id}`);
      if (!res.ok) return { isFavorite: false };
      return res.json();
    },
    enabled: !!user?.id && !!params?.id,
  });

  const isFavorite = favStatus?.isFavorite || (params?.id ? isLocalMealFavorite(params.id) : false);

  const handleToggleFavorite = async () => {
    if (!product?.id) return;
    const isNowFav = await toggleMealFavoriteWithApi(product.id, user?.id, product);
    queryClient.invalidateQueries({ queryKey: ['/api/favorites/check', user?.id, product.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/favorites/products', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['/api/products'] });

    toast({
      title: isNowFav ? "❤️ تمت الإضافة للمفضلة" : "تمت الإزالة من المفضلة",
      description: isNowFav ? `تم إضافة ${product.name} إلى قائمة مفضلاتك` : `تمت إزالة ${product.name} من قائمة مفضلاتك`,
    });
  };

  // 4. Related products from same store
  const { data: relatedProducts } = useQuery<MenuItem[]>({
    queryKey: [`/api/restaurants/${product?.restaurantId}/menu`],
    enabled: !!product?.restaurantId,
  });

  // 5. Handle Share
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name || 'السريع ون',
          text: `اطلب ${product?.name} الآن عبر تطبيق السريع ون!`,
          url: url,
        });
      } catch {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast({
        title: "تم نسخ الرابط",
        description: "تم نسخ رابط المنتج إلى الحافظة بنجاح",
      });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    // Add items to cart
    for (let i = 0; i < quantity; i++) {
      addItem(
        product, 
        product.restaurantId || 'store', 
        store?.name || 'المتجر الرئيسي'
      );
    }

    if (specialInstructions.trim()) {
      addNotes(product.id, specialInstructions.trim());
    }

    toast({
      title: "🛒 تمت الإضافة للسلة",
      description: `تم إضافة (${quantity}) من ${product.name} إلى سلتك بنجاح`,
    });
  };

  if (isProductLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 py-8 px-4" dir="rtl">
        <div className="max-w-5xl mx-auto animate-pulse space-y-6">
          <div className="h-10 bg-slate-200 rounded-xl w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
            <div className="aspect-square bg-slate-100 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-slate-100 rounded w-1/3" />
              <div className="h-8 bg-slate-100 rounded w-3/4" />
              <div className="h-6 bg-slate-100 rounded w-1/2" />
              <div className="h-20 bg-slate-100 rounded" />
              <div className="h-12 bg-slate-100 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center text-[#F05215] mb-4 shadow-xs">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">المنتج غير موجود أو تم إيقافه</h2>
        <p className="text-sm text-slate-500 max-w-sm mb-6">
          عذراً، قد يكون هذا المنتج غير متاح حالياً أو تم تغييره من قبل المتجر.
        </p>
        <Button 
          onClick={() => setLocation('/')}
          className="bg-gradient-to-r from-[#F05215] to-[#FF7840] text-white rounded-2xl h-12 px-6 font-bold shadow-md hover:shadow-lg"
        >
          <ArrowRight className="h-4 w-4 ml-2" />
          العودة للرئيسية
        </Button>
      </div>
    );
  }

  const numPrice = parseFloat(String(product.price)) || 0;
  const numOrigPrice = product.originalPrice ? parseFloat(String(product.originalPrice)) : 0;
  const hasDiscount = numOrigPrice > numPrice;
  const discountPercent = hasDiscount ? Math.round(((numOrigPrice - numPrice) / numOrigPrice) * 100) : 0;
  const totalPrice = (numPrice * quantity).toLocaleString();
  const isAvailable = product.isAvailable !== false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/80 via-white to-slate-50/50 pb-28 md:pb-16" dir="rtl">
      <main className="max-w-5xl mx-auto px-4 py-4 md:py-8">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation('/')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-[#F05215] transition-all font-bold text-xs shadow-xs"
            aria-label="الرجوع"
          >
            <ChevronRight className="h-4 w-4" />
            <span>رجوع</span>
          </button>

          {/* Breadcrumb text */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium truncate">
            <button onClick={() => setLocation('/')} className="hover:text-[#F05215] transition-colors">الرئيسية</button>
            <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
            {store && (
              <>
                <button onClick={() => setLocation(`/restaurant/${store.id}`)} className="hover:text-[#F05215] transition-colors truncate max-w-[120px]">
                  {store.name}
                </button>
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
              </>
            )}
            <span className="text-slate-800 font-bold truncate max-w-[150px]">{product.name}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#F05215] hover:border-orange-200 transition-all shadow-xs active:scale-95"
              title="مشاركة المنتج"
            >
              {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
            </button>
            <button
              onClick={handleToggleFavorite}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-red-500 hover:border-red-200 transition-all shadow-xs active:scale-95"
              title="إضافة للمفضلة"
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'text-red-500 fill-red-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main Product Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8">
          
          {/* Product Image Stage */}
          <div className="relative p-6 md:p-8 bg-gradient-to-br from-orange-50/50 via-slate-50/30 to-amber-50/30 flex items-center justify-center">
            <div className="relative w-full aspect-square max-w-[380px] rounded-2xl overflow-hidden shadow-md border border-white">
              <img 
                src={product.image || '/placeholder-food.png'} 
                alt={product.name} 
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              />

              {/* Badges */}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
                {hasDiscount && (
                  <Badge className="bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-md border-none">
                    خصم {discountPercent}%
                  </Badge>
                )}
                {product.isFeatured && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-md border-none flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    مميز
                  </Badge>
                )}
              </div>

              {!isAvailable && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-20">
                  <span className="bg-red-600 text-white text-sm font-black px-4 py-1.5 rounded-full shadow-lg">
                    غير متوفر حالياً
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Product Details Section */}
          <div className="p-6 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              
              {/* Category & Store Link */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {product.category && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-100/70 text-orange-800 border border-orange-200">
                    <Tag className="h-3 w-3" />
                    {product.category}
                  </span>
                )}

                {store && (
                  <button
                    onClick={() => setLocation(`/restaurant/${store.id}`)}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-slate-700 hover:text-[#F05215] bg-slate-100 hover:bg-orange-50 px-3 py-1 rounded-full transition-colors"
                  >
                    <Store className="h-3.5 w-3.5 text-[#F05215]" />
                    <span>{store.name}</span>
                  </button>
                )}
              </div>

              {/* Product Title */}
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                {product.name}
              </h1>

              {/* Ratings and meta */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl font-bold text-amber-900">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>{product.rating || '4.8'}</span>
                  <span className="text-amber-700 font-medium">({(product as any).reviewCount || (product as any).reviewsCount || '35+'})</span>
                </div>

                {product.salesCount ? (
                  <span className="text-slate-500 font-bold flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    {product.salesCount}+ تم طلبها
                  </span>
                ) : null}

                {(product as any).prepTime && (
                  <span className="text-slate-500 font-bold flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {(product as any).prepTime} دقيقة
                  </span>
                )}
              </div>

              {/* Price Row */}
              <div className="pt-2 flex items-baseline gap-3">
                <span className="text-3xl md:text-4xl font-black text-[#F05215]">
                  {numPrice.toLocaleString()} <span className="text-sm font-bold">ريال</span>
                </span>
                {hasDiscount && (
                  <span className="text-lg text-slate-400 line-through font-bold">
                    {numOrigPrice.toLocaleString()} ريال
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="pt-2">
                  <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase mb-1.5">
                    تفاصيل ومحتويات الوجبة
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Special Instructions Notes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                  <span>ملاحظات خاصة على الطلب (اختياري):</span>
                </label>
                <Textarea 
                  placeholder="مثال: بدون شطة، زيادة صوص، خبز محمص..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="rounded-2xl border-slate-200 text-xs resize-none bg-slate-50/50 focus:bg-white transition-all h-20"
                />
              </div>

              {/* Quantity Selector */}
              <div className="pt-2 flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-sm font-black text-slate-800">الكمية المطلوبة:</span>
                <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-orange-100 hover:text-[#F05215] text-slate-700 transition-colors active:scale-95"
                    aria-label="تقليل الكمية"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-black text-base text-slate-900">
                    {quantity}
                  </span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white transition-colors active:scale-95 shadow-xs"
                    aria-label="زيادة الكمية"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Add To Cart Button */}
            <div className="hidden md:block pt-4">
              <Button 
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#F05215] via-[#FF5722] to-[#FF7840] hover:from-[#E64A19] hover:to-[#F4511E] text-white font-black text-base gap-3 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.99]"
              >
                <ShoppingBag className="h-5 w-5" />
                <span>إضافة إلى السلة · {totalPrice} ريال</span>
              </Button>
            </div>

            {/* Service & Guarantee Notes */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                <Truck className="h-4 w-4 text-[#F05215] shrink-0" />
                <span>توصيل سريع ومباشر للعنوان</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>جودة مضمونة وتغليف محكم</span>
              </div>
            </div>

          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts && relatedProducts.length > 1 && (
          <div className="mt-12 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                <Store className="h-5 w-5 text-[#F05215]" />
                <span>المزيد من وجبات وقائمة {store?.name || 'المتجر'}</span>
              </h2>
              {store && (
                <button
                  onClick={() => setLocation(`/restaurant/${store.id}`)}
                  className="text-xs font-bold text-[#F05215] hover:underline"
                >
                  عرض الكل
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {relatedProducts
                .filter(p => p.id !== product.id)
                .slice(0, 5)
                .map((item) => (
                  <MenuItemCard 
                    key={item.id} 
                    item={item} 
                    restaurantId={product.restaurantId || ''} 
                    restaurantName={store?.name || 'المتجر'}
                  />
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky Add to Cart Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 p-3.5 flex items-center gap-3 md:hidden z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col min-w-[75px]">
          <span className="text-[10px] font-bold text-slate-400">الإجمالي:</span>
          <span className="text-base font-black text-[#F05215] leading-tight">
            {totalPrice} <span className="text-[10px]">ريال</span>
          </span>
        </div>
        <Button 
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#F05215] to-[#FF7840] hover:from-[#E64A19] hover:to-[#F4511E] text-white font-black text-sm gap-2 shadow-md shadow-orange-500/25 active:scale-95"
          onClick={handleAddToCart}
          disabled={!isAvailable}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>{isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}</span>
        </Button>
      </div>
    </div>
  );
}

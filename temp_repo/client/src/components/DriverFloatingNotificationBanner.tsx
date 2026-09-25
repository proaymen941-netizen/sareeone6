import React, { useEffect } from 'react';
import { Bell, Zap, X, MapPin, DollarSign, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { soundAlert } from '@/lib/soundAlert';
import { formatCurrency } from '@/lib/utils';

interface OrderInfo {
  id: string;
  orderNumber?: string;
  restaurantName?: string;
  driverEarnings?: string;
  totalAmount?: string;
  isWasalni?: boolean;
  fromAddress?: string;
  toAddress?: string;
}

interface DriverFloatingNotificationBannerProps {
  order: OrderInfo | null;
  onAccept: (orderId: string) => void;
  onViewAll: () => void;
  onDismiss: () => void;
}

export default function DriverFloatingNotificationBanner({
  order,
  onAccept,
  onViewAll,
  onDismiss
}: DriverFloatingNotificationBannerProps) {
  useEffect(() => {
    if (order) {
      soundAlert.startContinuousRingtone();
    } else {
      soundAlert.stopRingtone();
    }
    return () => {
      soundAlert.stopRingtone();
    };
  }, [order]);

  if (!order) return null;

  const orderNum = order.orderNumber || order.id?.slice(-6) || 'جديد';
  const restaurant = order.restaurantName || (order.isWasalni ? 'توصيل طلب (وصل لي)' : 'مطعم');
  const earnings = order.driverEarnings || order.totalAmount || '0';

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-bounce duration-1000 max-w-xl mx-auto" dir="rtl">
      <div className="bg-gradient-to-r from-orange-500 via-rose-500 to-red-600 rounded-2xl shadow-2xl p-4 text-white border-2 border-white/30 backdrop-blur-md relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md flex-shrink-0 animate-pulse border border-white/40">
              <span className="text-2xl">🚨</span>
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white drop-shadow-sm">
                يوجد طلب جديد متاح للاستلام الفوري!
              </h3>
              <p className="text-xs text-white/90 font-bold mt-0.5">
                طلب متجر #{orderNum} — {restaurant} — أرباحك: {formatCurrency(earnings)}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            title="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/20">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewAll}
            className="bg-white/10 hover:bg-white/20 text-white border-white/40 rounded-xl font-bold px-4 h-11"
          >
            عرض الكل (1)
          </Button>
          <Button
            size="sm"
            onClick={() => {
              soundAlert.stopRingtone();
              onAccept(order.id);
            }}
            className="bg-white hover:bg-orange-50 text-red-600 rounded-xl font-black px-6 h-11 shadow-lg gap-2 transform active:scale-95 transition-all"
          >
            <Zap className="h-4 w-4 fill-red-600 text-red-600 animate-bounce" />
            استلام الطلب الآن
          </Button>
        </div>
      </div>
    </div>
  );
}

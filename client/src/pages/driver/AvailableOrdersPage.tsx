import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, DollarSign, Clock, CheckCircle, CheckCircle2, Bell, Bike, ArrowLeftRight, Navigation, Sparkles, Volume2, Truck, AlertCircle, ShieldAlert, Users } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { soundAlert } from '@/lib/soundAlert';
import { CallContactDialog } from '@/components/CallContactDialog';
import { openInGoogleMaps } from '@/lib/mapUtils';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  status: string;
  items: string;
  totalAmount: string;
  driverEarnings: string;
  restaurantName?: string;
  createdAt: Date;
  driverId?: string;
  isWasalni?: boolean;
  fromAddress?: string;
  toAddress?: string;
  requestNumber?: string;
  orderType?: string;
  estimatedFee?: string;
  distanceKm?: number | null;
  customerDistanceKm?: number | null;
  distanceClassification?: string | null;
  isNearest?: boolean;
}

interface AvailableOrdersPageProps {
  driverId: string;
  onSelectOrder: (orderId: string) => void;
  onOrderAccepted?: () => void;
  onOrderClaimedByOther?: (driverName: string, orderNumber?: string, isWaselLi?: boolean) => void;
}

function parseOrderItems(itemsJson: any) {
  if (!itemsJson) return [];
  if (Array.isArray(itemsJson)) return itemsJson;
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export default function AvailableOrdersPage({ driverId, onSelectOrder, onOrderAccepted, onOrderClaimedByOther }: AvailableOrdersPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [updatingWasalniId, setUpdatingWasalniId] = useState<string | null>(null);
  const [callDialog, setCallDialog] = useState<{
    isOpen: boolean;
    name: string;
    role: 'customer' | 'restaurant' | 'admin';
    phone: string;
    orderNumber?: string;
    orderId?: string;
  }>({
    isOpen: false,
    name: '',
    role: 'customer',
    phone: '',
  });
  const [localClaimedPopup, setLocalClaimedPopup] = useState<{
    isOpen: boolean;
    orderNumber?: string;
    driverName?: string;
    isWaselLi?: boolean;
  } | null>(null);

  const driverToken = localStorage.getItem('driver_token');

  const { data: availableOrders = [], isLoading, refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ['/api/drivers/orders/available', driverId],
    queryFn: async () => {
      const response = await fetch('/api/drivers/orders/available', {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
    enabled: !!driverToken
  });

  const { data: wasalniOrders = [], isLoading: isLoadingWasalni, refetch: refetchWasalni } = useQuery<any[]>({
    queryKey: ['/api/drivers/wasalni', 'available', driverId],
    queryFn: async () => {
      const response = await fetch('/api/drivers/wasalni?status=available', {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
    enabled: !!driverToken
  });

  // استعلام فحص إمكانية استلام أكثر من طلب (نظام التوزيع العادل)
  const { data: multiOrderEligibility, refetch: refetchEligibility } = useQuery<any>({
    queryKey: ['/api/drivers/multi-order-eligibility', driverId],
    queryFn: async () => {
      const response = await fetch('/api/drivers/multi-order-eligibility', {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 5000,
    enabled: !!driverToken
  });

  const [isMuted, setIsMuted] = useState(soundAlert.getMuted());

  // بث ورنين الصوت بدون توقف عند وجود طلبات جديدة غير معينة، وإيقاف النغمة عند إسنادها/استلامها من قبل أي سائق
  useEffect(() => {
    const unassignedOrders = availableOrders.filter(o => !o.driverId && !['delivered', 'cancelled', 'completed'].includes(o.status));
    const unassignedWasalni = wasalniOrders.filter(w => !w.driverId && !['delivered', 'cancelled', 'completed'].includes(w.status));
    const totalCount = unassignedOrders.length + unassignedWasalni.length;

    if (totalCount > 0) {
      soundAlert.startContinuousRingtone();
    } else {
      soundAlert.stopRingtone();
    }

    return () => {
      soundAlert.stopRingtone();
    };
  }, [availableOrders, wasalniOrders]);

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      soundAlert.stopRingtone();
      const response = await fetch(`/api/drivers/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل في استلام الطلب');
      }
      return response.json();
    },
    onSuccess: (data, orderId) => {
      soundAlert.stopRingtone();
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/orders/available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });
      setAcceptingOrderId(null);
      toast({ title: "✅ تم استلام الطلب بنجاح", description: "تم قبول الطلب ونقله إلى طلباتك النشطة" });
      if (onOrderAccepted) onOrderAccepted();
    },
    onError: (error: Error) => {
      setAcceptingOrderId(null);
      soundAlert.stopRingtone();
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/orders/available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });

      if (error.message.includes('تم استلام هذا الطلب بالفعل') || error.message.includes('alreadyClaimed')) {
        const match = error.message.match(/السائق:\s*([^,]+)/);
        const name = match ? match[1].trim() : 'سائق آخر';
        if (onOrderClaimedByOther) {
          onOrderClaimedByOther(name, '', false);
        } else {
          setLocalClaimedPopup({
            isOpen: true,
            driverName: name,
            orderNumber: '',
            isWaselLi: false
          });
        }
      } else {
        toast({ title: "⚠️ تعذر استلام الطلب", description: error.message, variant: "destructive" });
      }
    }
  });

  const acceptWasalniMutation = useMutation({
    mutationFn: async (requestId: string) => {
      soundAlert.stopRingtone();
      const response = await fetch(`/api/drivers/wasalni/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'فشل في استلام طلب وصل لي');
      }
      return response.json();
    },
    onSuccess: () => {
      soundAlert.stopRingtone();
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/wasalni', 'available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });
      setUpdatingWasalniId(null);
      toast({ title: "✅ تم استلام طلب وصل لي بنجاح", description: "يمكنك الآن البدء في عملية التوصيل" });
      if (onOrderAccepted) onOrderAccepted();
    },
    onError: (error: Error) => {
      setUpdatingWasalniId(null);
      soundAlert.stopRingtone();
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/wasalni', 'available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });

      if (error.message.includes('تم استلام هذا الطلب بالفعل') || error.message.includes('alreadyClaimed')) {
        const match = error.message.match(/السائق:\s*([^,]+)/);
        const name = match ? match[1].trim() : 'سائق آخر';
        if (onOrderClaimedByOther) {
          onOrderClaimedByOther(name, '', true);
        } else {
          setLocalClaimedPopup({
            isOpen: true,
            driverName: name,
            orderNumber: '',
            isWaselLi: true
          });
        }
      } else {
        toast({ title: "⚠️ تعذر استلام طلب وصل لي", description: error.message, variant: "destructive" });
      }
    }
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchOrders(), refetchWasalni(), refetchEligibility()]);
    setRefreshing(false);
  };

  const totalCount = availableOrders.length + wasalniOrders.length;

  if ((isLoading || isLoadingWasalni) && totalCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الطلبات المتاحة لجميع السائقين...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">الطلبات المتاحة</h1>
              {totalCount > 0 && (
                <Button variant="ghost" size="icon" onClick={() => soundAlert.playNewOrderRingtone()} title="اختبار نغمة التنبيه">
                  <Volume2 className="h-5 w-5 text-green-600 animate-bounce" />
                </Button>
              )}
            </div>
            <p className="text-gray-600 font-medium">{totalCount} طلب متاح للاستلام المباشر</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2 border-green-200 hover:bg-green-50">
            <Clock className="h-4 w-4 text-green-600" />
            {refreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
        </div>

        {/* تنبيه نظام توزيع الطلبات العادل وتعدد الطلبات */}
        {multiOrderEligibility && multiOrderEligibility.currentActiveCount > 0 && (
          <div className={`rounded-xl p-3.5 mb-5 border shadow-sm flex items-start gap-3 transition-all ${
            multiOrderEligibility.allowed 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}>
            {multiOrderEligibility.allowed ? (
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  {multiOrderEligibility.allowed ? '⚡ مسموح استلام طلبات إضافية' : '🔒 استلام أكثر من طلب مقيد حالياً'}
                </span>
                <Badge variant="outline" className={`text-xs ${
                  multiOrderEligibility.allowed 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {multiOrderEligibility.allowed ? 'ضغط طلبات' : 'توزيع عادل'}
                </Badge>
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {multiOrderEligibility.message || (multiOrderEligibility.allowed 
                  ? 'جميع الموصلين مشغولون بطلبات جارية، مسموح لك باستلام طلب إضافي لتغطية ضغط التوصيل.'
                  : 'لديك طلب نشط بالفعل، ولا يمكن استلام أكثر من طلب لوجود كباتن آخرين متاحين لتفادي تأخير التوصيل.')}
              </p>
            </div>
          </div>
        )}

        {totalCount === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center">
              <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-700 font-bold text-lg">لا توجد طلبات جديدة متاحة حالياً</p>
              <p className="text-gray-500 mt-2 text-sm">سيقوم الخادم بالرنين وإصدار تنبيه صوتي فور قيام أي عميل بإرسال طلب جديد</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* طلبات المتاجر العادية */}
            {availableOrders.map((order) => {
              const isMine = order.driverId === driverId;
              return (
                <Card key={order.id} className={`hover:shadow-lg transition-all ${order.isNearest ? 'border-2 border-emerald-500 bg-emerald-50/20' : ''}`} onClick={() => onSelectOrder(order.id)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg text-gray-900">طلب #{order.orderNumber}</p>
                          {order.isNearest && (
                            <Badge className="bg-emerald-600 text-white gap-1 animate-pulse">
                              <Sparkles className="h-3 w-3" />
                              الأقرب إليك!
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-green-700">{order.restaurantName || 'المتجر الرئيسي'}</p>
                        <p className="text-xs text-gray-500">{formatDate(order.createdAt)} - {new Date(order.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      {isMine ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">مُستلم من قبلك</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">متاح لجميع السائقين</Badge>
                      )}
                    </div>

                    <div className="space-y-2 mb-4 border-t pt-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-gray-700 font-medium">{order.deliveryAddress}</p>
                          {order.distanceKm !== null && order.distanceKm !== undefined && (
                            <div className="flex flex-col gap-1 mt-1">
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded inline-flex w-fit">
                                📍 المتجر يبعد عنك {order.distanceKm} كم
                                {order.distanceClassification && ` (${order.distanceClassification})`}
                              </span>
                              {order.customerDistanceKm !== null && order.customerDistanceKm !== undefined && (
                                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded inline-flex w-fit">
                                  📍 العميل يبعد عنك {order.customerDistanceKm} كم
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap bg-gray-50 p-2 rounded-lg border">
                        <div className="flex items-center gap-1 text-sm font-bold text-green-700">
                          <DollarSign className="h-4 w-4 shrink-0" />
                          <span>عمولة التوصيل: {formatCurrency(order.driverEarnings || (parseFloat(order.totalAmount || '0') * 0.15))}</span>
                        </div>
                        {order.totalAmount && (
                          <span className="text-xs text-gray-500 font-semibold">إجمالي الطلب: {formatCurrency(order.totalAmount)}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500 shrink-0" />
                        <p className="text-sm text-gray-600">العميل: <span className="font-bold text-gray-800">{order.customerName}</span> ({order.customerPhone})</p>
                      </div>

                      {(() => {
                        const items = parseOrderItems(order.items);
                        if (items.length === 0) return null;
                        return (
                          <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100 mt-2 text-xs">
                            <p className="font-bold text-emerald-800 mb-1">📦 أصناف الطلب ({items.length}):</p>
                            <p className="text-gray-700 line-clamp-2">
                              {items.map((it: any) => `${it.name || it.title || 'صنف'} (x${it.quantity || 1})`).join('، ')}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex gap-2 pt-3 border-t flex-wrap items-center justify-between">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCallDialog({
                            isOpen: true,
                            name: order.customerName,
                            role: 'customer',
                            phone: order.customerPhone,
                            orderNumber: order.orderNumber,
                            orderId: order.id,
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      >
                        <Phone className="h-4 w-4 text-emerald-600" />اتصال وتواصل
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openInGoogleMaps({
                            lat: (order as any).customerLocationLat,
                            lng: (order as any).customerLocationLng,
                            address: order.deliveryAddress,
                            label: order.customerName,
                            mode: 'search'
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                      >
                        <Navigation className="h-4 w-4 text-blue-600" />
                        موقع العميل
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAcceptingOrderId(order.id);
                          acceptOrderMutation.mutate(order.id);
                        }}
                        disabled={acceptingOrderId === order.id && acceptOrderMutation.isPending}
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white font-bold"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {acceptingOrderId === order.id && acceptOrderMutation.isPending ? 'جاري الاستلام...' : 'استلام الطلب الآن'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* طلبات وصل لي */}
            {wasalniOrders.map((req) => {
              const isMine = req.driverId === driverId;
              return (
                <Card key={req.id} className={`hover:shadow-lg transition-all border-2 border-orange-200 ${req.isNearest ? 'bg-orange-50/40 border-orange-400' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Bike className="h-5 w-5 text-orange-600" />
                          <p className="font-bold text-lg text-orange-800">وصل لي #{req.requestNumber}</p>
                          {req.isNearest && (
                            <Badge className="bg-orange-600 text-white gap-1 animate-pulse">
                              <Sparkles className="h-3 w-3" />
                              الأقرب إليك!
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{req.orderType || 'توصيل طرد'}</p>
                        <p className="text-xs text-gray-400">{req.createdAt ? new Date(req.createdAt).toLocaleString('ar-YE') : ''}</p>
                      </div>

                      {isMine ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">مُستلم من قبلك</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">طلب "وصل لي" متاح</Badge>
                      )}
                    </div>

                    <div className="space-y-2 mb-4 border-t pt-3">
                      <div className="flex items-start gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold">من (موقع الاستلام)</p>
                          <p className="text-sm text-gray-800 font-medium">{req.fromAddress}</p>
                          {req.distanceKm !== null && req.distanceKm !== undefined && (
                            <div className="flex flex-col gap-1 mt-1">
                              <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded inline-flex w-fit">
                                📍 نقطة الاستلام تبعد عنك {req.distanceKm} كم
                                {req.distanceClassification && ` (${req.distanceClassification})`}
                              </span>
                              {req.customerDistanceKm !== null && req.customerDistanceKm !== undefined && (
                                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded inline-flex w-fit">
                                  📍 نقطة التوصيل تبعد عنك {req.customerDistanceKm} كم
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pr-3">
                        <ArrowLeftRight className="h-3 w-3 text-gray-400" />
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold">إلى (موقع التسليم)</p>
                          <p className="text-sm text-gray-800 font-medium">{req.toAddress}</p>
                        </div>
                      </div>

                      {req.estimatedFee && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-orange-600 shrink-0" />
                          <p className="text-sm font-bold text-orange-600">
                            رسوم التوصيل: {parseFloat(req.estimatedFee).toLocaleString()} ر.ي
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500 shrink-0" />
                        <p className="text-sm text-gray-600">العميل: {req.customerName} ({req.customerPhone})</p>
                      </div>

                      {req.notes && (
                        <p className="text-xs text-gray-600 bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                          ملاحظة: {req.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t flex-wrap items-center justify-between">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCallDialog({
                            isOpen: true,
                            name: req.customerName,
                            role: 'customer',
                            phone: req.customerPhone,
                            orderNumber: req.orderNumber || req.requestNumber,
                            orderId: req.id,
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      >
                        <Phone className="h-4 w-4 text-emerald-600" />اتصال وتواصل
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openInGoogleMaps({
                            lat: (req as any).toLat,
                            lng: (req as any).toLng,
                            address: req.toAddress,
                            label: req.customerName,
                            mode: 'search'
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                      >
                        <Navigation className="h-4 w-4 text-red-600" />
                        موقع التسليم
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUpdatingWasalniId(req.id);
                          acceptWasalniMutation.mutate(req.id);
                        }}
                        disabled={updatingWasalniId === req.id && acceptWasalniMutation.isPending}
                        size="sm"
                        className="gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {updatingWasalniId === req.id && acceptWasalniMutation.isPending ? 'جاري الاستلام...' : 'استلام طلب وصل لي'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* نافذة منبثقة مباشرة عند استلام الطلب من سائق آخر */}
      {localClaimedPopup?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-gray-100">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-amber-50">
              <Truck className="h-8 w-8" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              تم استلام هذا الطلب بالفعل!
            </h3>
            
            <div className="my-4 p-4 bg-gray-50 rounded-xl border border-gray-200/80 text-gray-700 space-y-2">
              {localClaimedPopup.orderNumber && (
                <p className="text-sm text-gray-500">
                  {localClaimedPopup.isWaselLi ? 'طلب وصل لي رقم:' : 'الطلب رقم:'} <strong className="text-gray-900 font-mono text-base">#{localClaimedPopup.orderNumber}</strong>
                </p>
              )}
              <p className="text-base font-medium">
                تم استلام وتوصيل الطلب من قِبل زميلك السائق:
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-extrabold text-lg shadow-xs">
                <span>🛵 {localClaimedPopup.driverName}</span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              سبقك زميلك في قبول واستلام هذا الطلب بأجزاء من الثانية. تم إيقاف الرنين وستتلقى تنبيهاً فور توفر طلبات جديدة!
            </p>
            
            <Button 
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-base shadow-md"
              onClick={() => setLocalClaimedPopup(null)}
            >
              حسناً، فهمت
            </Button>
          </div>
        </div>
      )}

      <CallContactDialog
        isOpen={callDialog.isOpen}
        onClose={() => setCallDialog(prev => ({ ...prev, isOpen: false }))}
        contactName={callDialog.name}
        contactRole={callDialog.role}
        phoneNumber={callDialog.phone}
        orderNumber={callDialog.orderNumber}
        orderId={callDialog.orderId}
      />
    </div>
  );
}


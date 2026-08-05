import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, DollarSign, Clock, CheckCircle, Bell, Bike, ArrowLeftRight, Navigation, Sparkles, Volume2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { soundAlert } from '@/lib/soundAlert';

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
  isNearest?: boolean;
}

interface AvailableOrdersPageProps {
  driverId: string;
  onSelectOrder: (orderId: string) => void;
  onOrderAccepted?: () => void;
}

export default function AvailableOrdersPage({ driverId, onSelectOrder, onOrderAccepted }: AvailableOrdersPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [updatingWasalniId, setUpdatingWasalniId] = useState<string | null>(null);

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
    refetchInterval: 12000,
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
    refetchInterval: 12000,
    enabled: !!driverToken
  });

  // بث الصوت عند وجود طلبات جديدة غير معينة
  useEffect(() => {
    const totalCount = availableOrders.length + wasalniOrders.length;
    if (totalCount > 0) {
      soundAlert.playNewOrderRingtone();
    }
  }, [availableOrders.length, wasalniOrders.length]);

  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/orders/available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });
      setAcceptingOrderId(null);
      toast({ title: "✅ تم استلام الطلب بنجاح", description: "تم قبول الطلب ونقله إلى طلباتك النشطة" });
      if (onOrderAccepted) onOrderAccepted();
    },
    onError: (error: Error) => {
      setAcceptingOrderId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/orders/available', driverId] });
      toast({ title: "⚠️ تعذر استلام الطلب", description: error.message, variant: "destructive" });
    }
  });

  const acceptWasalniMutation = useMutation({
    mutationFn: async (requestId: string) => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/wasalni', 'available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });
      setUpdatingWasalniId(null);
      toast({ title: "✅ تم استلام طلب وصل لي بنجاح", description: "يمكنك الآن البدء في عملية التوصيل" });
      if (onOrderAccepted) onOrderAccepted();
    },
    onError: (error: Error) => {
      setUpdatingWasalniId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/wasalni', 'available', driverId] });
      toast({ title: "⚠️ تعذر استلام طلب وصل لي", description: error.message, variant: "destructive" });
    }
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchOrders(), refetchWasalni()]);
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
        <div className="flex justify-between items-center mb-6">
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
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded mt-1 inline-block">
                              📍 يبعد {order.distanceKm} كم عن موقعك
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600 shrink-0" />
                        <p className="text-sm font-bold text-green-600">عمولة التوصيل المقدرة: {formatCurrency(order.driverEarnings || (parseFloat(order.totalAmount) * 0.15))}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500 shrink-0" />
                        <p className="text-sm text-gray-600">العميل: {order.customerName}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t flex-wrap items-center justify-between">
                      <Button onClick={(e) => { e.stopPropagation(); window.open(`tel:${order.customerPhone}`); }} variant="outline" size="sm" className="gap-2">
                        <Phone className="h-4 w-4" />اتصال
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
                            <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded mt-1 inline-block">
                              📍 يبعد {req.distanceKm} كم عنك
                            </span>
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
                      <Button onClick={(e) => { e.stopPropagation(); window.open(`tel:${req.customerPhone}`); }} variant="outline" size="sm" className="gap-2">
                        <Phone className="h-4 w-4" />اتصال بالعميل
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
    </div>
  );
}


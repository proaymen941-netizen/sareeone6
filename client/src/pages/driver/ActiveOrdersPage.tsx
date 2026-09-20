import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Phone, Navigation, CheckCircle, Package, Clock, Bike, ArrowLeftRight, DollarSign, Store, Map as MapIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DriverMapView from '@/components/maps/DriverMapView';
import { openInGoogleMaps } from '@/lib/mapUtils';
import { formatCurrency, formatDate } from '@/lib/utils';
import { soundAlert } from '@/lib/soundAlert';
import { CallContactDialog } from '@/components/CallContactDialog';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  customerLocationLat?: string;
  customerLocationLng?: string;
  status: string;
  items: string;
  totalAmount: string;
  driverEarnings: string;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantLatitude?: string;
  restaurantLongitude?: string;
  createdAt: Date;
  driverId?: string;
  distanceKm?: number | null;
  customerDistanceKm?: number | null;
  distanceClassification?: string | null;
}

interface ActiveOrdersPageProps {
  driverId: string;
  onSelectOrder: (orderId: string) => void;
}

export default function ActiveOrdersPage({ driverId, onSelectOrder }: ActiveOrdersPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [updatingWasalniId, setUpdatingWasalniId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [mapModalOrder, setMapModalOrder] = useState<any | null>(null);
  const [callDialog, setCallDialog] = useState<{
    isOpen: boolean;
    name: string;
    role: 'customer' | 'restaurant' | 'admin';
    phone: string;
    orderNumber?: string;
  }>({
    isOpen: false,
    name: '',
    role: 'customer',
    phone: '',
  });

  const driverToken = localStorage.getItem('driver_token');

  const { data: myOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['/api/drivers/orders', 'active', driverId],
    queryFn: async () => {
      const response = await fetch(`/api/drivers/orders?status=active`, {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
    enabled: !!driverToken
  });

  const { data: activeWasalni = [], isLoading: isLoadingWasalni } = useQuery<any[]>({
    queryKey: ['/api/drivers/wasalni', 'active', driverId],
    queryFn: async () => {
      const response = await fetch('/api/drivers/wasalni?status=active', {
        headers: { 'Authorization': `Bearer ${driverToken}` }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
    enabled: !!driverToken
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      soundAlert.stopRingtone();
      const response = await fetch(`/api/drivers/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update order');
      return response.json();
    },
    onSuccess: () => {
      soundAlert.stopRingtone();
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/orders', 'active', driverId] });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/orders/available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });
      setUpdatingOrderId(null);
      toast({ title: "تم التحديث ✅", description: "تم تحديث حالة الطلب بنجاح" });
    },
    onError: (error: Error) => {
      soundAlert.stopRingtone();
      setUpdatingOrderId(null);
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const updateWasalniMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      soundAlert.stopRingtone();
      const response = await fetch(`/api/drivers/wasalni/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${driverToken}`
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update wasalni');
      }
      return response.json();
    },
    onSuccess: () => {
      soundAlert.stopRingtone();
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/wasalni', 'active', driverId] });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers/wasalni', 'available', driverId] });
      queryClient.invalidateQueries({ queryKey: [`/api/drivers/app/dashboard`] });
      setUpdatingWasalniId(null);
      toast({ title: "✅ تم تحديث وصل لي" });
    },
    onError: (error: Error) => {
      soundAlert.stopRingtone();
      setUpdatingWasalniId(null);
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const activeOrders = myOrders.filter(order =>
    ['assigned', 'accepted', 'pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'on_way', 'on_the_way'].includes(order.status)
  );

  const totalActive = activeOrders.length + activeWasalni.length;

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      assigned: 'تم قبول الطلب (توجه للمتجر)',
      accepted: 'تم قبول الطلب (توجه للمتجر)',
      pending: 'قيد الانتظار',
      preparing: 'قيد التحضير بالمطعم',
      ready: 'جاهز للاستلام بالمطعم',
      picked_up: 'تم الاستلام من المتجر',
      on_way: 'في الطريق إلى العميل 🛵',
      on_the_way: 'في الطريق إلى العميل 🛵',
      confirmed: 'مؤكد',
      delivered: 'تم التسليم'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      assigned: 'bg-cyan-100 text-cyan-800',
      accepted: 'bg-cyan-100 text-cyan-800',
      pending: 'bg-yellow-100 text-yellow-800',
      preparing: 'bg-orange-100 text-orange-800',
      ready: 'bg-purple-100 text-purple-800',
      picked_up: 'bg-indigo-100 text-indigo-800',
      on_way: 'bg-blue-100 text-blue-800',
      on_the_way: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-blue-100 text-blue-800',
      delivered: 'bg-emerald-100 text-emerald-800'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getNextStatus = (status: string) => {
    const flow: Record<string, string> = {
      assigned: 'picked_up',
      accepted: 'picked_up',
      confirmed: 'picked_up',
      pending: 'picked_up',
      preparing: 'ready',
      ready: 'picked_up',
      picked_up: 'on_way',
      on_way: 'delivered',
      on_the_way: 'delivered'
    };
    return flow[status] || 'picked_up';
  };

  const getNextStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      assigned: 'تم الاستلام من المتجر',
      accepted: 'تم الاستلام من المتجر',
      confirmed: 'تم الاستلام من المتجر',
      pending: 'تم الاستلام من المتجر',
      preparing: 'جاهز للاستلام',
      ready: 'تم الاستلام من المتجر',
      picked_up: 'في الطريق إلى العميل 🛵',
      on_way: 'تم التسليم للعميل ✅',
      on_the_way: 'تم التسليم للعميل ✅'
    };
    return labels[status] || 'تحديث الحالة';
  };

  if ((isLoading || isLoadingWasalni) && totalActive === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>جاري تحميل الطلبات النشطة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">الطلبات النشطة</h1>
        <p className="text-gray-600 mb-6">{totalActive} طلب نشط</p>

        {totalActive === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg">لا توجد طلبات نشطة</p>
              <p className="text-gray-400 mt-2">جميع الطلبات مكتملة أو بانتظار القبول</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* طلبات المتاجر العادية */}
            {activeOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelectOrder(order.id)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-lg">طلب #{order.orderNumber}</p>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                      <p className="text-xs text-gray-400">{formatDate(order.createdAt)} - {new Date(order.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>{getStatusText(order.status)}</Badge>
                  </div>
                  <div className="space-y-2 mb-4 border-t pt-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
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
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <p className="text-sm text-gray-600">{order.customerPhone}</p>
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded mb-4 border border-green-200">
                    <p className="text-sm text-green-700"><span className="font-bold">عمولتك:</span> {formatCurrency(order.driverEarnings)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCallDialog({
                          isOpen: true,
                          name: order.customerName,
                          role: 'customer',
                          phone: order.customerPhone,
                          orderNumber: order.orderNumber,
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
                          lat: order.customerLocationLat,
                          lng: order.customerLocationLng,
                          address: order.deliveryAddress,
                          label: order.customerName,
                          mode: 'navigate'
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50 font-bold"
                    >
                      <Navigation className="h-4 w-4 text-red-600" />
                      تتبع العميل (خرائط)
                    </Button>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMapModalOrder(order);
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50"
                    >
                      <MapIcon className="h-4 w-4 text-blue-600" />
                      الخريطة
                    </Button>

                    {order.status !== 'on_way' && order.status !== 'on_the_way' && order.status !== 'delivered' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUpdatingOrderId(order.id);
                          updateOrderStatusMutation.mutate({ orderId: order.id, status: 'on_way' });
                        }}
                        disabled={updatingOrderId === order.id && updateOrderStatusMutation.isPending}
                        size="sm"
                        variant="outline"
                        className="gap-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        في الطريق 🛵
                      </Button>
                    )}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextStatus = getNextStatus(order.status);
                        if (nextStatus) {
                          setUpdatingOrderId(order.id);
                          updateOrderStatusMutation.mutate({ orderId: order.id, status: nextStatus });
                        }
                      }}
                      disabled={updatingOrderId === order.id && updateOrderStatusMutation.isPending}
                      size="sm"
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white mr-auto"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {updatingOrderId === order.id && updateOrderStatusMutation.isPending ? 'جاري...' : getNextStatusLabel(order.status)}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* طلبات وصل لي النشطة */}
            {activeWasalni.map((req) => (
              <Card key={req.id} className="hover:shadow-lg transition-shadow border-2 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Bike className="h-4 w-4 text-orange-500" />
                        <p className="font-bold text-lg text-orange-700">وصل لي #{req.requestNumber}</p>
                      </div>
                      <p className="text-sm text-gray-500">{req.orderType || 'توصيل'}</p>
                    </div>
                    <Badge className={req.status === 'on_way' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                      {req.status === 'on_way' ? 'في الطريق' : 'مؤكد'}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4 border-t pt-3">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] text-gray-400 font-bold">من (الاستلام)</p>
                        <p className="text-sm text-gray-700">{req.fromAddress}</p>
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
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold">إلى (التوصيل)</p>
                        <p className="text-sm text-gray-700">{req.toAddress}</p>
                      </div>
                    </div>
                    {req.estimatedFee && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-orange-600" />
                        <p className="text-sm font-bold text-orange-600">{parseFloat(req.estimatedFee).toLocaleString()} ر.ي</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <p className="text-sm text-gray-600">{req.customerName} - {req.customerPhone}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t flex-wrap">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCallDialog({
                          isOpen: true,
                          name: req.customerName,
                          role: 'customer',
                          phone: req.customerPhone,
                          orderNumber: req.orderNumber || req.requestNumber,
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
                          lat: req.toLat,
                          lng: req.toLng,
                          address: req.toAddress,
                          label: req.customerName,
                          mode: 'navigate'
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50 font-bold"
                    >
                      <Navigation className="h-4 w-4 text-red-600" />
                      تتبع العميل (خرائط)
                    </Button>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        openInGoogleMaps({
                          lat: req.fromLat,
                          lng: req.fromLng,
                          address: req.fromAddress,
                          label: 'موقع الاستلام - وصل لي',
                          mode: 'navigate'
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 font-medium"
                    >
                      <Store className="h-4 w-4 text-amber-600" />
                      موقع الاستلام
                    </Button>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMapModalOrder({
                          ...req,
                          customerLocationLat: req.toLat,
                          customerLocationLng: req.toLng,
                          restaurantLatitude: req.fromLat,
                          restaurantLongitude: req.fromLng,
                          deliveryAddress: req.toAddress,
                          restaurantAddress: req.fromAddress,
                          restaurantName: 'موقع الاستلام (وصل لي)',
                          isWasalni: true,
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50"
                    >
                      <MapIcon className="h-4 w-4 text-blue-600" />
                      الخريطة
                    </Button>

                    {req.status === 'confirmed' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUpdatingWasalniId(req.id);
                          updateWasalniMutation.mutate({ id: req.id, status: 'on_way' });
                        }}
                        disabled={updatingWasalniId === req.id && updateWasalniMutation.isPending}
                        size="sm"
                        className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Navigation className="h-4 w-4" />
                        {updatingWasalniId === req.id && updateWasalniMutation.isPending ? 'جاري...' : 'في الطريق'}
                      </Button>
                    )}
                    {req.status === 'on_way' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUpdatingWasalniId(req.id);
                          updateWasalniMutation.mutate({ id: req.id, status: 'delivered' });
                        }}
                        disabled={updatingWasalniId === req.id && updateWasalniMutation.isPending}
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white ml-auto"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {updatingWasalniId === req.id && updateWasalniMutation.isPending ? 'جاري...' : 'تم التسليم'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CallContactDialog
        isOpen={callDialog.isOpen}
        onClose={() => setCallDialog(prev => ({ ...prev, isOpen: false }))}
        contactName={callDialog.name}
        contactRole={callDialog.role}
        phoneNumber={callDialog.phone}
        orderNumber={callDialog.orderNumber}
      />

      {/* نافذة الخريطة التفاعلية */}
      <Dialog open={!!mapModalOrder} onOpenChange={(open) => !open && setMapModalOrder(null)}>
        <DialogContent className="max-w-3xl w-[95vw] p-4 max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base font-bold flex items-center justify-between">
              <span>خريطة ومسار الطلب #{mapModalOrder?.orderNumber || mapModalOrder?.requestNumber || mapModalOrder?.id?.slice(-6)}</span>
            </DialogTitle>
          </DialogHeader>
          {mapModalOrder && (
            <div className="space-y-3 mt-2">
              <DriverMapView
                orders={[mapModalOrder]}
                height="360px"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    openInGoogleMaps({
                      lat: mapModalOrder.customerLocationLat ?? mapModalOrder.toLat,
                      lng: mapModalOrder.customerLocationLng ?? mapModalOrder.toLng,
                      address: mapModalOrder.deliveryAddress ?? mapModalOrder.toAddress,
                      label: mapModalOrder.customerName,
                      mode: 'navigate'
                    });
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 text-xs h-10 shadow-xs"
                >
                  <Navigation className="h-4 w-4" />
                  توجيه Google Maps لعنوان العميل
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    openInGoogleMaps({
                      lat: mapModalOrder.restaurantLatitude ?? mapModalOrder.restaurantLat ?? mapModalOrder.fromLat,
                      lng: mapModalOrder.restaurantLongitude ?? mapModalOrder.restaurantLng ?? mapModalOrder.fromLng,
                      address: mapModalOrder.restaurantAddress ?? mapModalOrder.fromAddress,
                      label: mapModalOrder.restaurantName || 'موقع الاستلام',
                      mode: 'navigate'
                    });
                  }}
                  className="border-amber-500 text-amber-700 hover:bg-amber-50 font-bold gap-2 text-xs h-10"
                >
                  <Store className="h-4 w-4 text-amber-600" />
                  توجيه Google Maps لموقع الاستلام
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

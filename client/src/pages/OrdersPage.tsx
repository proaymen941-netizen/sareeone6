import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { ArrowRight, Package, Clock, CheckCircle, XCircle, Eye, Loader, Star, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import RatingDialog from '@/components/RatingDialog';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  notes?: string;
  paymentMethod: string;
  items: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  totalAmount: string;
  restaurantId: string;
  restaurantName?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  isRated?: boolean;
  status: 'pending' | 'confirmed' | 'preparing' | 'on_way' | 'delivered' | 'cancelled' | 'scheduled';
  createdAt: string;
  updatedAt: string;
  estimatedTime?: string;
  driverEarnings: string;
  customerId?: string;
  parsedItems?: OrderItem[];
  _isWasalni?: boolean;
}

interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  restaurantId?: string;
  restaurantName?: string;
}

export default function OrdersPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // نافذة إلغاء الطلب
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');

  const CANCEL_REASONS = language === 'ar' ? [
    'غيّرت رأيي',
    'طلبت بالخطأ',
    'تأخر وقت التوصيل',
    'لا يوجد سائق متاح',
    'مشكلة في الدفع',
    'سبب آخر',
  ] : [
    'Changed my mind',
    'Ordered by mistake',
    'Delivery taking too long',
    'No driver available',
    'Payment issue',
    'Other reason',
  ];

  const otherReasonKey = language === 'ar' ? 'سبب آخر' : 'Other reason';

  const customerPhone = user?.phone || localStorage.getItem('customer_phone');
  const customerId = user?.id || '';

  const { data: orders = [], isLoading, error } = useQuery<Order[]>({
    queryKey: ['orders', customerPhone, customerId],
    enabled: !!(customerPhone || customerId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (customerId) params.set('customerId', customerId);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const phoneSegment = customerPhone
        ? encodeURIComponent(customerPhone)
        : (customerId ? `id:${encodeURIComponent(customerId)}` : '');

      const [ordersRes, wasalniRes] = await Promise.all([
        fetch(`/api/orders/customer/${phoneSegment}${queryStr}`),
        fetch(`/api/wasalni?phone=${encodeURIComponent(customerPhone || '')}`),
      ]);
      if (!ordersRes.ok) {
        throw new Error(language === 'ar' ? 'فشل في جلب الطلبات' : 'Failed to fetch orders');
      }
      const data: Order[] = await ordersRes.json();

      const foodOrders: Order[] = data.map((order: Order) => {
        let parsedItems: OrderItem[] = [];
        try {
          parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items as any);
        } catch (e) {
          console.error('Error parsing order items:', e);
        }

        let restaurantName = order.restaurantName;
        if (!restaurantName && parsedItems.length > 0 && parsedItems[0].restaurantName) {
          restaurantName = parsedItems[0].restaurantName;
        } else if (!restaurantName) {
          restaurantName = language === 'ar' ? 'المتجر الرئيسي' : 'Main Store';
        }

        return { ...order, restaurantName, parsedItems };
      });

      // دمج طلبات وصل لي
      let wasalniOrders: Order[] = [];
      if (wasalniRes.ok) {
        try {
          const wasalniData: any[] = await wasalniRes.json();
          wasalniOrders = (wasalniData || [])
            .map((w) => ({
              id: w.id,
              orderNumber: w.requestNumber,
              customerName: w.customerName,
              customerPhone: w.customerPhone,
              deliveryAddress: w.toAddress,
              notes: w.notes || '',
              paymentMethod: 'cash',
              items: '[]',
              subtotal: w.estimatedFee || '0',
              deliveryFee: w.estimatedFee || '0',
              total: w.estimatedFee || '0',
              totalAmount: w.estimatedFee || '0',
              restaurantId: '',
              restaurantName: `${language === 'ar' ? 'وصل لي' : 'Wasalni'} - ${w.orderType || (language === 'ar' ? 'توصيل' : 'Delivery')}`,
              status: w.status,
              createdAt: w.createdAt,
              updatedAt: w.updatedAt,
              driverEarnings: '0',
              _isWasalni: true,
              parsedItems: [
                { name: `${language === 'ar' ? 'من' : 'From'}: ${w.fromAddress}`, quantity: 1, price: 0 },
                { name: `${language === 'ar' ? 'إلى' : 'To'}: ${w.toAddress}`, quantity: 1, price: 0 },
              ],
            } as Order));
        } catch (e) {
          console.error('Error loading Wasalni orders:', e);
        }
      }

      const merged = [...foodOrders, ...wasalniOrders];
      merged.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return merged;
    },
    refetchInterval: 30000,
    retry: 1
  });

  // اشتراك WebSocket
  useEffect(() => {
    if (!customerPhone) return;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onopen = () => {
          const customerId = user?.id;
          if (customerId) {
            ws?.send(JSON.stringify({
              type: 'auth',
              payload: { userId: customerId, userType: 'customer' },
            }));
          }
          if (customerPhone && customerPhone !== customerId) {
            ws?.send(JSON.stringify({
              type: 'auth',
              payload: { userId: customerPhone, userType: 'customer' },
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (
              message.type === 'order_update' ||
              message.type === 'order_status_changed' ||
              message.type === 'new_wasalni_request' ||
              message.type === 'driver_assigned'
            ) {
              queryClient.invalidateQueries({ queryKey: ['orders', customerPhone, customerId] });
            }
          } catch (err) {
            console.error('Failed to parse WS message in OrdersPage:', err);
          }
        };

        ws.onclose = () => {
          if (!cancelled) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        };
        ws.onerror = () => {
          try { ws?.close(); } catch {}
        };
      } catch (err) {
        console.error('WebSocket connection failed:', err);
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      try { ws?.close(); } catch {}
    };
  }, [customerPhone, customerId, user?.id, queryClient]);

  // طلب الإلغاء
  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason, isWasalni }: { orderId: string; reason: string; isWasalni?: boolean }) => {
      const url = isWasalni ? `/api/wasalni/${orderId}` : `/api/orders/${orderId}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancelReason: reason, updatedBy: customerPhone, updatedByType: 'customer' }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || (language === 'ar' ? 'فشل في إلغاء الطلب' : 'Failed to cancel order'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', customerPhone] });
      toast({
        title: language === 'ar' ? "تم إلغاء الطلب" : "Order Cancelled",
        description: language === 'ar' ? "تم إلغاء طلبك بنجاح" : "Your order has been cancelled successfully",
      });
      setShowCancelDialog(false);
      setCancellingOrder(null);
      setCancelReason('');
      setCustomCancelReason('');
    },
    onError: (err: any) => {
      toast({
        title: language === 'ar' ? "خطأ في الإلغاء" : "Cancellation Error",
        description: err.message || (language === 'ar' ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Error occurred, please try again"),
        variant: "destructive",
      });
    }
  });

  const getStatusLabel = (status: string) => {
    const statusMapAr: Record<string, string> = {
      pending: 'قيد المراجعة',
      confirmed: 'مؤكد',
      preparing: 'قيد التحضير',
      on_way: 'في الطريق',
      delivered: 'تم التوصيل',
      cancelled: 'ملغي',
      scheduled: 'مجدول',
    };
    const statusMapEn: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      on_way: 'On the way',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      scheduled: 'Scheduled',
    };
    return (language === 'ar' ? statusMapAr[status] : statusMapEn[status]) || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      preparing: 'bg-orange-500',
      on_way: 'bg-purple-500',
      delivered: 'bg-green-500',
      cancelled: 'bg-red-500',
      scheduled: 'bg-teal-500',
    };
    return colorMap[status] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, any> = {
      pending: Clock,
      confirmed: Package,
      preparing: Package,
      on_way: Package,
      delivered: CheckCircle,
      cancelled: XCircle,
      scheduled: Clock,
    };
    return iconMap[status] || Clock;
  };

  const canCancelOrder = (status: string) => {
    return ['pending', 'confirmed', 'preparing', 'scheduled'].includes(status);
  };

  const displayOrders = orders;

  const filteredOrders = displayOrders.filter(order => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'active') return ['pending', 'confirmed', 'preparing', 'on_way', 'scheduled'].includes(order.status);
    if (selectedTab === 'completed') return order.status === 'delivered';
    if (selectedTab === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  const handleViewOrder = (orderId: string) => {
    setLocation(`/orders/${orderId}`);
  };

  const handleRateOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowRatingDialog(true);
  };

  const handleReorder = (order: Order) => {
    toast({
      title: language === 'ar' ? "جاري إعادة الطلب" : "Reordering",
      description: language === 'ar' ? `سيتم إضافة عناصر طلب ${order.orderNumber} إلى السلة` : `Items from order ${order.orderNumber} are being added`,
    });
  };

  const openCancelDialog = (order: Order) => {
    setCancellingOrder(order);
    setCancelReason('');
    setCustomCancelReason('');
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    if (!cancellingOrder) return;
    const finalReason = cancelReason === otherReasonKey ? customCancelReason.trim() : cancelReason;
    if (!finalReason) {
      toast({ 
        title: language === 'ar' ? "الرجاء اختيار سبب الإلغاء" : "Please choose a reason for cancellation", 
        variant: "destructive" 
      });
      return;
    }
    cancelOrderMutation.mutate({ orderId: cancellingOrder.id, reason: finalReason, isWasalni: cancellingOrder._isWasalni });
  };

  const tabs = [
    { id: 'all', label: language === 'ar' ? 'جميع الطلبات' : 'All Orders', count: displayOrders.length },
    { id: 'active', label: language === 'ar' ? 'النشطة' : 'Active', count: displayOrders.filter(o => ['pending', 'confirmed', 'preparing', 'on_way', 'scheduled'].includes(o.status)).length },
    { id: 'completed', label: language === 'ar' ? 'المكتملة' : 'Completed', count: displayOrders.filter(o => o.status === 'delivered').length },
    { id: 'cancelled', label: language === 'ar' ? 'الملغية' : 'Cancelled', count: displayOrders.filter(o => o.status === 'cancelled').length }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-[#FF5722]" />
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 mb-4">{language === 'ar' ? 'حدث خطأ في تحميل الطلبات' : 'Error loading orders'}</p>
          <Button onClick={() => window.location.reload()} className="bg-[#FF5722] hover:bg-[#E64A19] text-white">
            {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* رأس الصفحة */}
      <div className="bg-gradient-to-r from-[#FF6E40] via-[#FF5722] to-[#E64A19] text-white shadow-md rounded-b-[28px] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-2xl"
              onClick={() => setLocation('/')}
              data-testid="button-back"
            >
              <ArrowRight className={`h-5 w-5 ${language === 'en' ? 'rotate-180' : ''}`} />
            </Button>
            <div>
              <h1 className="text-xl font-black text-white">{t('my_orders')}</h1>
              <p className="text-xs text-orange-100 font-bold">
                {language === 'ar' ? 'تتبع ومراجعة طلباتك السابقة والحالية' : 'Track and review your past and active orders'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="max-w-2xl mx-auto p-4">
        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
          <TabsList className="grid w-full grid-cols-4 mb-5 p-1 bg-white border border-orange-100/80 rounded-2xl shadow-xs">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="text-xs font-black rounded-xl py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#FF6E40] data-[state=active]:to-[#FF5722] data-[state=active]:text-white relative"
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full text-[10px] font-black bg-[#FF5722] text-white border border-white">
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedTab} className="space-y-4">
            {filteredOrders.length === 0 ? (
              <Card className="rounded-3xl border border-orange-100/80 shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden bg-white">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 rounded-3xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-4 text-[#FF5722]">
                    <Package className="h-8 w-8 text-[#FF5722]" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 mb-1">{t('no_orders')}</h3>
                  <p className="text-xs text-slate-400 font-bold mb-4">
                    {language === 'ar' ? 'لم تقم بأي طلبات في هذا القسم بعد' : 'You have no orders in this category yet'}
                  </p>
                  <Button 
                    onClick={() => setLocation('/')} 
                    data-testid="button-start-ordering"
                    className="bg-gradient-to-r from-[#FF6E40] to-[#FF5722] hover:from-[#FF5722] hover:to-[#E64A19] text-white font-black rounded-2xl px-6 py-2.5 shadow-md shadow-orange-500/20"
                  >
                    {t('start_ordering')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredOrders.map((order) => {
                const StatusIcon = getStatusIcon(order.status);
                
                return (
                  <Card key={order.id} className="rounded-3xl border border-orange-100/70 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(255,87,34,0.07)] transition-all overflow-hidden bg-white">
                    <CardHeader className="pb-3 bg-orange-50/30 border-b border-orange-100/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-black text-slate-900">{order.restaurantName || (language === 'ar' ? 'طلب سريع ون' : 'Saree One Order')}</CardTitle>
                          <p className="text-xs text-slate-400 font-bold mt-0.5">
                            {language === 'ar' ? 'طلب رقم:' : 'Order #:'} {order.orderNumber}
                          </p>
                        </div>
                        <Badge 
                          className={`${getStatusColor(order.status)} text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-xs`}
                          data-testid={`badge-status-${order.status}`}
                        >
                          <StatusIcon className={`w-3.5 h-3.5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 pt-4">
                      {/* عناصر الطلب */}
                      <div className="space-y-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                        {order.parsedItems?.map((item: OrderItem, index: number) => (
                          <div key={index} className="flex justify-between text-xs font-bold text-slate-700">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="text-slate-900 font-black">{formatCurrency(item.price)}</span>
                          </div>
                        )) || (
                          <div className="text-xs text-slate-400 font-bold">
                            {language === 'ar' ? 'لا توجد تفاصيل العناصر' : 'No items details'}
                          </div>
                        )}
                      </div>

                      {/* ملخص الطلب */}
                      <div className="pt-1 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-600">
                          <span>
                            {language === 'ar' ? 'عدد الأصناف:' : 'Items count:'} {order.parsedItems?.reduce((sum: number, item: OrderItem) => sum + item.quantity, 0) || 0}
                          </span>
                          <span className="text-[#FF5722] font-black text-sm">
                            {language === 'ar' ? 'المجموع:' : 'Total:'} {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 font-bold">
                          <span>
                            {language === 'ar' ? 'تاريخ الطلب:' : 'Date:'} {formatDate(order.createdAt)} - {new Date(order.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-YE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {order.estimatedTime && (
                            <span className="text-[#FF5722]">
                              {language === 'ar' ? 'الوقت المتوقع:' : 'Est. time:'} {order.estimatedTime}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 font-bold">
                          <span>{t('delivery_address')}: {order.deliveryAddress}</span>
                          <span>{t('payment_method')}: {order.paymentMethod === 'cash' ? t('cash_on_delivery') : t('online_payment')}</span>
                        </div>
                      </div>

                      {/* أزرار الإجراءات */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl font-black text-xs border-orange-200 hover:bg-orange-50 text-[#FF5722]"
                          onClick={() => handleViewOrder(order.id)}
                          data-testid={`button-view-order-${order.id}`}
                        >
                          <Eye className={`w-3.5 h-3.5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                          {t('track_order')}
                        </Button>

                        {/* زر الإلغاء - يظهر للطلبات النشطة القابلة للإلغاء */}
                        {canCancelOrder(order.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-xl font-black text-xs border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => openCancelDialog(order)}
                            data-testid={`button-cancel-order-${order.id}`}
                          >
                            <X className={`w-3.5 h-3.5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                            {language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                          </Button>
                        )}
                        
                        {order.status === 'delivered' && !order.isRated && (
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 rounded-xl font-black text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                            onClick={() => handleRateOrder(order)}
                          >
                            <Star className={`w-3.5 h-3.5 fill-white ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                            {language === 'ar' ? 'تقييم' : 'Rate'}
                          </Button>
                        )}

                        {order.status === 'on_way' && order.driverPhone && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 rounded-xl font-black text-xs border-blue-400 text-blue-600 hover:bg-blue-50"
                            onClick={() => window.location.href = `tel:${order.driverPhone}`}
                          >
                            <Phone className={`w-3.5 h-3.5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                            {language === 'ar' ? 'اتصال بالسائق' : 'Call Driver'}
                          </Button>
                        )}
                        
                        {order.status === 'delivered' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 rounded-xl font-black text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
                            onClick={() => handleReorder(order)}
                            data-testid={`button-reorder-${order.id}`}
                          >
                            {t('reorder')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {selectedOrder && (
          <RatingDialog
            isOpen={showRatingDialog}
            onClose={() => {
              setShowRatingDialog(false);
              setSelectedOrder(null);
            }}
            orderId={selectedOrder.id}
            restaurantName={selectedOrder.restaurantName || (language === 'ar' ? "المطعم" : "Restaurant")}
            driverName={selectedOrder.driverName}
            customerId={selectedOrder.customerId || user?.id}
          />
        )}
      </div>

      {/* نافذة إلغاء الطلب */}
      {showCancelDialog && cancellingOrder && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* رأس النافذة */}
            <div className="bg-red-500 px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  <h3 className="font-black text-lg">
                    {language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-white/80 text-sm mt-1">
                {language === 'ar' ? 'طلب رقم:' : 'Order #:'} {cancellingOrder.orderNumber}
              </p>
            </div>

            {/* المحتوى */}
            <div className="px-5 py-4">
              <p className="text-gray-700 font-bold text-sm mb-4">
                {language === 'ar' ? 'يرجى اختيار سبب الإلغاء:' : 'Please select cancellation reason:'}
              </p>

              <div className="space-y-2 mb-4">
                {CANCEL_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setCancelReason(reason)}
                    className={`w-full ${language === 'ar' ? 'text-right' : 'text-left'} px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold ${
                      cancelReason === reason
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-100 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {cancelReason === otherReasonKey && (
                <textarea
                  placeholder={language === 'ar' ? "اكتب سبب الإلغاء..." : "Write cancellation reason..."}
                  value={customCancelReason}
                  onChange={(e) => setCustomCancelReason(e.target.value)}
                  className="w-full p-3 border-2 rounded-xl text-sm focus:border-red-400 outline-none resize-none mb-4"
                  rows={3}
                />
              )}

              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleConfirmCancel}
                  disabled={cancelOrderMutation.isPending || !cancelReason || (cancelReason === otherReasonKey && !customCancelReason.trim())}
                >
                  {cancelOrderMutation.isPending ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    language === 'ar' ? 'تأكيد الإلغاء' : 'Confirm Cancel'
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCancelDialog(false)}
                  disabled={cancelOrderMutation.isPending}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

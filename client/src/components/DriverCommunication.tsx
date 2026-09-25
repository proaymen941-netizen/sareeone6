import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageCircle, MapPin, Clock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { makePhoneCall } from './PermissionsManager';
import { OrderChatModal } from './OrderChatModal';

interface Driver {
  id: string;
  name: string;
  phone: string;
  currentLocation?: string;
  isAvailable: boolean;
}

interface DriverCommunicationProps {
  driver: Driver;
  orderId?: string;
  orderNumber: string;
  customerLocation?: string;
}

export function DriverCommunication({ driver, orderId, orderNumber, customerLocation }: DriverCommunicationProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const customerId = user?.phone || user?.id || localStorage.getItem('customer_phone') || 'customer_user';

  const handlePhoneCall = () => {
    try {
      makePhoneCall(driver.phone);
      toast({
        title: 'جاري الاتصال',
        description: `جاري الاتصال بالمندوب ${driver.name}`,
      });
    } catch (error) {
      toast({
        title: 'خطأ في الاتصال',
        description: 'لا يمكن إجراء المكالمة الآن',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              معلومات المندوب
            </div>
            <Badge variant={driver.isAvailable ? "default" : "secondary"}>
              {driver.isAvailable ? 'متاح' : 'غير متاح'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">اسم المندوب:</span>
              <span className="font-medium">{driver.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">رقم الهاتف:</span>
              <span className="font-medium">{driver.phone}</span>
            </div>
            {driver.currentLocation && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الموقع الحالي:</span>
                <span className="font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {driver.currentLocation}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handlePhoneCall}
              className="flex items-center gap-2"
              data-testid="call-driver-button"
            >
              <Phone className="h-4 w-4" />
              اتصال
            </Button>

            <Button
              variant="outline"
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-2 border-primary text-primary hover:bg-primary/10"
              data-testid="chat-driver-button"
            >
              <MessageCircle className="h-4 w-4" />
              مراسلة عبر النظام
            </Button>
          </div>

          {customerLocation && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">عنوان التوصيل:</span>
              </div>
              <p className="text-sm text-muted-foreground">{customerLocation}</p>
            </div>
          )}

          <div className="bg-primary/10 p-3 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">رقم الطلب:</span>
              <span className="font-bold text-primary">{orderNumber}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <OrderChatModal
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        orderId={orderId || orderNumber}
        orderNumber={orderNumber}
        recipientName={driver.name}
        recipientPhone={driver.phone}
        currentUserType="customer"
        currentUserId={customerId}
      />
    </>
  );
}

export function useDriverCommunication() {
  const { toast } = useToast();
  const callDriver = (driverPhone: string, driverName: string) => {
    try {
      makePhoneCall(driverPhone);
      toast({
        title: 'جاري الاتصال',
        description: `جاري الاتصال بالمندوب ${driverName}`,
      });
    } catch (error) {
      toast({
        title: 'خطأ في الاتصال',
        description: 'لا يمكن إجراء المكالمة الآن',
        variant: 'destructive',
      });
    }
  };

  const messageDriver = (_driverPhone: string, driverName: string, _orderNumber: string, _message: string) => {
    toast({
      title: 'مراسلة فورية عبر النظام',
      description: `تم فتح محادثة النظام مع المندوب ${driverName}`,
    });
  };

  return { callDriver, messageDriver };
}

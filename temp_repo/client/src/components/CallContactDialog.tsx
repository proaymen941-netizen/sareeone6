import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, Copy, Check, User, Store, Headphones, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { safeTriggerPhoneCall, copyToClipboard, getWhatsAppLink, formatYemenPhone } from '@/lib/callUtils';

export interface CallContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactName?: string;
  contactRole?: 'customer' | 'restaurant' | 'admin' | string;
  phoneNumber?: string;
  orderNumber?: string;
}

export function CallContactDialog({
  isOpen,
  onClose,
  contactName = 'العميل',
  contactRole = 'customer',
  phoneNumber = '',
  orderNumber,
}: CallContactDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!phoneNumber) return null;

  const phoneInfo = formatYemenPhone(phoneNumber);

  const getRoleLabel = () => {
    switch (contactRole) {
      case 'customer': return { title: 'العميل', icon: <User className="h-4 w-4" /> };
      case 'restaurant': return { title: 'المتجر / المطعم', icon: <Store className="h-4 w-4" /> };
      case 'admin': return { title: 'خدمة العملاء والإدارة', icon: <Headphones className="h-4 w-4" /> };
      default: return { title: contactRole, icon: <User className="h-4 w-4" /> };
    }
  };

  const roleInfo = getRoleLabel();

  const handleDirectCall = () => {
    // محاولة فتح لوحة الاتصال بشكل آمن لا يعطل الـ WebView
    safeTriggerPhoneCall(phoneNumber);
    // نسخ الرقم للحافظة تلقائياً كضمان للمستخدم
    copyToClipboard(phoneInfo.display);
    toast({
      title: '📞 جاري فتح لوحة الاتصال...',
      description: `تم نسخ الرقم (${phoneInfo.display}) للحافظة للاحتياط.`,
    });
  };

  const handleWhatsApp = () => {
    let msg = `السلام عليكم ${contactName}`;
    if (orderNumber) {
      msg += `، أنا مندوب توصيل طلبك رقم #${orderNumber} من تطبيق السريع.`;
    } else {
      msg += `، أنا مندوب التوصيل من تطبيق السريع.`;
    }
    const url = getWhatsAppLink(phoneNumber, msg);
    
    // فتح الرابط بشكل آمن ومتوافق مع Android WebView
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try { document.body.removeChild(link); } catch (_) {}
    }, 500);

    toast({
      title: '💬 جاري فتح واتساب...',
      description: `تم توجيهك لمحادثة ${contactName}`,
    });
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(phoneInfo.display);
    if (success) {
      setCopied(true);
      toast({
        title: '✅ تم نسخ الرقم',
        description: `تم نسخ الرقم ${phoneInfo.display} إلى الحافظة`,
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm w-[92vw] rounded-2xl p-5 text-right font-sans" dir="rtl">
        <DialogHeader className="text-right space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full w-fit">
            {roleInfo.icon}
            <span>{roleInfo.title}</span>
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900 mt-1">
            الاتصال والتواصل
          </DialogTitle>
          <DialogDescription className="text-gray-500 text-xs">
            {contactName} {orderNumber ? `(طلب #${orderNumber})` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* عرض رقم الهاتف بشكل بارز مع زر النسخ */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 flex items-center justify-between my-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-8 px-2 text-xs gap-1 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </Button>
          </div>
          <span className="font-mono text-lg font-extrabold text-gray-800 tracking-wider" dir="ltr">
            {phoneInfo.display}
          </span>
        </div>

        {/* خيارات الاتصال الفورية */}
        <div className="space-y-2.5 pt-1">
          {/* اتصال هاتفي شريحة */}
          <Button
            onClick={handleDirectCall}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm gap-2.5 shadow-md flex items-center justify-center"
          >
            <Phone className="h-5 w-5 fill-current" />
            <span>اتصال هاتفي مباشر (شريحة)</span>
          </Button>

          {/* محادثة واتساب */}
          <Button
            onClick={handleWhatsApp}
            className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm gap-2.5 shadow-md flex items-center justify-center"
          >
            <MessageCircle className="h-5 w-5" />
            <span>مراسلة عبر واتساب (WhatsApp)</span>
          </Button>

          {/* نسخ الرقم للاتصال اليدوي */}
          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full h-10 border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs gap-2 flex items-center justify-center font-medium"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            <span>نسخ الرقم للاتصال من سجل هاتفك</span>
          </Button>
        </div>

        <div className="mt-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-800 h-8"
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

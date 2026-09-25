import React from 'react';
import WhatsAppChatBox from '@/components/admin/WhatsAppChatBox';
import { MessageSquare, ShieldCheck, Headphones, Store, Truck, User } from 'lucide-react';

export default function AdminWhatsAppChat() {
  return (
    <div className="space-y-4 p-2 sm:p-4 max-w-7xl mx-auto" dir="rtl">
      {/* رأس الصفحة مع الشعار والمعلومات */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff4500] via-[#ff5722] to-[#ff6a00] text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Headphones className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
              صندوق المحادثات والدعم
              <span className="bg-gradient-to-r from-[#ff4500] to-[#ff6a00] text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                استقبال ورد مباشر
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              الرد الفوري على رسائل العملاء، الكباتن، والموردين/المتاجر وتقديم الدعم السريع
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600 bg-orange-50/70 border border-orange-200 px-3 py-2 rounded-xl self-start sm:self-auto">
          <ShieldCheck className="h-4 w-4 text-[#ff4500]" />
          <span className="font-semibold text-orange-950">قناة الدعم والرد الرسمي للإدارة</span>
        </div>
      </div>

      {/* صندوق المحادثات المتكامل للرد على العملاء والموردين والسائقين */}
      <WhatsAppChatBox className="min-h-[700px] h-[calc(100vh-210px)]" />
    </div>
  );
}

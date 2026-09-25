import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

interface OutOfDeliveryZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeLocation?: () => void;
  reason?: string;
  isPreview?: boolean;
}

export default function OutOfDeliveryZoneModal({
  isOpen,
  onClose,
  onChangeLocation,
  reason,
  isPreview = false
}: OutOfDeliveryZoneModalProps) {
  // Fetch system settings for customer support contact
  const { data: settings } = useQuery<any[]>({
    queryKey: ['/api/ui-settings'],
    staleTime: 60000,
  });

  const supportWhatsapp = settings?.find((s: any) => s.key === 'support_whatsapp')?.value || '967777146387';
  const cleanWhatsappNumber = supportWhatsapp.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent('مرحباً خدمة العملاء، أود الاستفسار بشأن إمكانية التوصيل إلى موقعي.')}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="out-of-zone-title"
          dir="rtl"
        >
          {/* Backdrop click to close */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={onClose}
          />

          {/* Modal Container - Matches image cleanly */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-[340px] sm:max-w-[360px] bg-white dark:bg-gray-900 rounded-[28px] p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-gray-800 text-center z-10 overflow-hidden"
          >
            {/* Circular Red Crying Face (Exact match to reference image) */}
            <div className="w-24 h-24 mx-auto rounded-full border-[3.5px] border-[#EA1D2C] bg-red-50/20 dark:bg-red-950/20 flex items-center justify-center mt-2 mb-6">
              <svg 
                className="w-16 h-16 text-[#EA1D2C]" 
                viewBox="0 0 48 48" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.8" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                {/* Left Eye */}
                <ellipse cx="17.5" cy="18.5" rx="2.2" ry="2.8" fill="currentColor" stroke="none" />
                {/* Right Eye */}
                <ellipse cx="30.5" cy="18.5" rx="2.2" ry="2.8" fill="currentColor" stroke="none" />
                {/* Teardrop under left eye (viewer's left / character's right) */}
                <path 
                  d="M16 23.5 C16 25 14.5 26.5 14.5 28 C14.5 29.5 15.6 30.5 17 30.5 C18.4 30.5 19.5 29.5 19.5 28 C19.5 26.5 17.5 25 16 23.5 Z" 
                  fill="currentColor" 
                  stroke="none" 
                />
                {/* Sad downturned mouth */}
                <path d="M16.5 33.5 C19.5 29 28.5 29 31.5 33.5" strokeWidth="3" />
              </svg>
            </div>

            {/* Main Title: "خارج نطاق التوصيل" */}
            <h2 
              id="out-of-zone-title" 
              className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-5"
            >
              خارج نطاق التوصيل
            </h2>

            {/* Optional sub-reason if provided and not generic */}
            {reason && !reason.includes('نطاق التوصيل') && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 px-2">
                {reason}
              </p>
            )}

            {/* Support Pill Button: "تواصل معنا [24]" */}
            <div className="mb-6 flex justify-center">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2.5 bg-[#FFF0F2] dark:bg-rose-950/40 hover:bg-[#FFE2E6] dark:hover:bg-rose-900/60 text-[#EA1D2C] dark:text-rose-300 border border-rose-100 dark:border-rose-900/40 rounded-2xl py-3 px-6 font-bold text-sm sm:text-base transition-all shadow-xs group cursor-pointer"
              >
                <span>تواصل معنا</span>
                <div className="flex items-center justify-center border border-[#EA1D2C] dark:border-rose-300 text-[#EA1D2C] dark:text-rose-300 text-[10px] font-black rounded-[5px] px-1.5 py-0.5 leading-none">
                  24
                </div>
              </a>
            </div>

            {/* Action Buttons: "تغيير العنوان" (Red Solid) & "اغلاق" (White Outline) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Change Address Button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onChangeLocation) {
                    onChangeLocation();
                  }
                }}
                className="w-full h-12 bg-[#EA1D2C] hover:bg-[#D01724] active:scale-[0.98] text-white font-bold text-sm sm:text-base rounded-2xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
                data-testid="button-change-delivery-address"
              >
                تغيير العنوان
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 border-2 border-[#EA1D2C] dark:border-[#EA1D2C] bg-white dark:bg-gray-800 hover:bg-red-50/50 dark:hover:bg-gray-700 active:scale-[0.98] text-[#EA1D2C] dark:text-rose-300 font-bold text-sm sm:text-base rounded-2xl transition-all flex items-center justify-center cursor-pointer"
                data-testid="button-close-out-of-zone"
              >
                اغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


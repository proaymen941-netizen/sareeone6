import { Button } from '@/components/ui/button';

interface AppClosedOverlayProps {
  openingTime?: string;
  closingTime?: string;
  message: string;
  onScheduleOrder?: (scheduledDate: string, scheduledTimeSlot: string) => void;
  onClose?: () => void;
  scheduledOrdersEnabled?: boolean;
}

export default function AppClosedOverlay({
  message,
  onClose,
}: AppClosedOverlayProps) {
  return (
    <div className="fixed inset-0 z-[9990] bg-black/60 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
          {/* Smiley / Closed icon */}
          <div className="w-20 h-20 rounded-full border-4 border-red-400 flex items-center justify-center mb-5">
            <svg viewBox="0 0 100 100" className="w-14 h-14 text-red-400" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="50" cy="50" r="45" />
              <circle cx="35" cy="40" r="4" fill="currentColor" stroke="none" />
              <circle cx="65" cy="40" r="4" fill="currentColor" stroke="none" />
              <path d="M 30 62 Q 50 75 70 62" />
            </svg>
          </div>

          {/* Message */}
          <p className="text-gray-800 text-base font-semibold leading-relaxed mb-1">
            {message || 'عذراً، لا يمكنك الطلب حالياً؛ المتجر مغلق.'}
          </p>
        </div>

        {/* Action button */}
        <div className="flex border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-4 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

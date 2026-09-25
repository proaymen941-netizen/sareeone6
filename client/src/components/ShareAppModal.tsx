import React, { useState } from 'react';
import { 
  Share2, 
  Copy, 
  Check, 
  X, 
  Smartphone, 
  ExternalLink,
  QrCode
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../context/LanguageContext';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  shareText: string;
  shareUrl: string;
  logoUrl?: string;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  isOpen,
  onClose,
  appName,
  shareText,
  shareUrl,
  logoUrl
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const finalUrl = (shareUrl && shareUrl.trim().length > 0) ? shareUrl.trim() : window.location.origin;
  const fullMessage = `${shareText}\n${finalUrl}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(finalUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = finalUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast({
        title: language === 'ar' ? 'تم نسخ الرابط!' : 'Link Copied!',
        description: language === 'ar' ? 'تم نسخ رابط التطبيق إلى الحافظة بنجاح.' : 'App link copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy', err);
      toast({
        title: language === 'ar' ? 'تعذر النسخ' : 'Copy Failed',
        description: finalUrl,
        variant: 'destructive',
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: appName,
          text: shareText,
          url: finalUrl,
        });
        onClose();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const shareToWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMessage)}`;
    window.open(url, '_blank');
  };

  const shareToTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(finalUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(finalUrl)}`;
    window.open(url, '_blank');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(finalUrl)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-0 shadow-2xl bg-white">
        <DialogTitle className="sr-only">
          {language === 'ar' ? 'مشاركة التطبيق' : 'Share App'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {shareText}
        </DialogDescription>

        {/* Gradient Header */}
        <div className="relative bg-gradient-to-br from-[#FF5722] via-[#F4511E] to-[#E64A19] text-white p-6 pb-7 text-center">
          <button
            onClick={onClose}
            className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'} p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors`}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md p-2 flex items-center justify-center shadow-lg mb-3 border border-white/30">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="h-full w-full object-contain drop-shadow" />
            ) : (
              <Share2 className="h-8 w-8 text-white" />
            )}
          </div>

          <h3 className="text-xl font-black tracking-tight">{language === 'ar' ? 'مشاركة التطبيق' : 'Share App'}</h3>
          <p className="text-xs text-white/90 font-medium mt-1 max-w-xs mx-auto">
            {language === 'ar' 
              ? `شارك تطبيق ${appName} مع أصدقائك وعائلتك واطلبوا معاً`
              : `Share ${appName} with your friends and family`}
          </p>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          
          {/* Social Share Grid */}
          <div className="grid grid-cols-4 gap-2.5">
            {/* WhatsApp */}
            <button
              onClick={shareToWhatsApp}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-green-50 hover:bg-green-100/80 border border-green-200 text-green-700 transition-all active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-xl bg-green-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
              </div>
              <span className="text-[11px] font-black">{language === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
            </button>

            {/* Telegram */}
            <button
              onClick={shareToTelegram}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-sky-50 hover:bg-sky-100/80 border border-sky-200 text-sky-700 transition-all active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z" />
                </svg>
              </div>
              <span className="text-[11px] font-black">{language === 'ar' ? 'تيليجرام' : 'Telegram'}</span>
            </button>

            {/* Facebook */}
            <button
              onClick={shareToFacebook}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-blue-700 transition-all active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </div>
              <span className="text-[11px] font-black">{language === 'ar' ? 'فيسبوك' : 'Facebook'}</span>
            </button>

            {/* Twitter / X */}
            <button
              onClick={shareToTwitter}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all active:scale-95 group"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <span className="text-[11px] font-black">X / تويتر</span>
            </button>
          </div>

          {/* Copy Link Field */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0 px-2 font-mono text-xs text-slate-600 truncate select-all">
              {finalUrl}
            </div>
            <Button
              onClick={handleCopyLink}
              size="sm"
              className={`h-9 px-4 rounded-xl font-black text-xs transition-all shadow-sm ${
                copied 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-[#FF5722] hover:bg-[#F4511E] text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {language === 'ar' ? 'تم النسخ' : 'Copied'}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {language === 'ar' ? 'نسخ الرابط' : 'Copy'}
                </>
              )}
            </Button>
          </div>

          {/* System Share or Close */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button
              onClick={handleNativeShare}
              variant="outline"
              className="w-full h-11 rounded-2xl border-slate-200 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 text-slate-700"
            >
              <Smartphone className="h-4 w-4 text-[#FF5722]" />
              {language === 'ar' ? 'خيارات مشاركة إضافية عبر الهاتف' : 'More System Share Options'}
            </Button>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareAppModal;

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageCircle, 
  Send, 
  X, 
  User, 
  Bot,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'customer' | 'driver';
}

export default function ChatOverlay({ isOpen, onClose, userType }: ChatOverlayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveUserId = user?.id || user?.phone || (userType === 'driver' ? (localStorage.getItem('driver_phone') || 'driver_guest') : (localStorage.getItem('customer_phone') || 'customer_guest'));

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/chat/admin', effectiveUserId, userType],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const res = await fetch(`/api/messages/admin-chat?userId=${encodeURIComponent(effectiveUserId)}&userType=${userType}`);
      if (!res.ok) throw new Error('فشل جلب الرسائل');
      const data = await res.json();
      return data.messages || [];
    },
    enabled: isOpen && !!effectiveUserId,
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          senderId: effectiveUserId,
          senderType: userType,
          receiverId: 'admin', // Default admin ID or indicator
          receiverType: 'admin',
          orderId: null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل إرسال الرسالة');
      }
      return res.json();
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/chat/admin', effectiveUserId, userType] });
      refetch();
    },
    onError: (err: any) => {
      toast({ 
        title: 'فشل الإرسال', 
        description: err?.message || 'تعذر التواصل مع الإدارة حالياً',
        variant: 'destructive' 
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message.trim());
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-[3000] flex flex-col overflow-hidden h-[500px]"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-primary p-4 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <p className="font-black text-sm">التواصل مع الإدارة</p>
              <p className="text-[10px] text-white/70 font-bold">نحن هنا لمساعدتك دائماً</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages list */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50"
        >
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
              <MessageCircle className="h-12 w-12 mb-2 text-primary" />
              <p className="text-xs font-bold text-gray-600">ابدأ المحادثة مع الإدارة الآن</p>
              <p className="text-[10px] text-gray-400 mt-1">اطرح استفساراتك أو قدم شكوى وسنرد عليك في أقرب وقت</p>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isMe = msg.senderId === effectiveUserId || (msg.senderType === userType && msg.senderId !== 'admin');
              return (
                <div 
                  key={msg.id} 
                  className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm text-sm ${
                    isMe 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={`text-[9px] mt-1 text-left ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSend} className="p-4 border-t bg-white flex items-center gap-2 shrink-0">
          <Input 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="اكتب رسالتك هنا..."
            className="rounded-xl border-gray-200 focus:border-primary text-sm h-11"
            disabled={sendMessageMutation.isPending}
          />
          <Button 
            type="submit" 
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="rounded-xl h-11 w-11 p-0 bg-primary hover:bg-primary/90 shrink-0 shadow-md"
          >
            {sendMessageMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}

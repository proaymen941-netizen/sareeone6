import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '../context/CartContext';
import { useState, useEffect } from 'react';
import { Cart } from './Cart';
import { formatCurrency } from '@/lib/utils';

export default function CartButton() {
  const { state } = useCart();
  const [showCart, setShowCart] = useState(false);
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  // Listen for openCart event from header, cards, or notifications
  useEffect(() => {
    const handleOpenCart = () => {
      setShowCart(true);
    };
    window.addEventListener('openCart', handleOpenCart);
    return () => {
      window.removeEventListener('openCart', handleOpenCart);
    };
  }, []);

  return (
    <>
      {itemCount > 0 && (
        <div className="fixed bottom-20 md:bottom-8 left-4 md:left-auto md:right-8 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Button
            className="relative bg-gradient-to-r from-[#F05215] to-[#D03800] hover:from-[#E04205] hover:to-[#B02800] text-white font-bold h-12 md:h-14 px-4 md:px-6 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 hover:scale-105 active:scale-95 transition-all"
            onClick={() => setShowCart(true)}
            data-testid="button-floating-cart"
          >
            <div className="relative flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
              <span
                className="absolute -top-3 -right-3 bg-red-600 text-white text-[10px] md:text-xs font-black rounded-full h-5 w-5 md:h-6 md:w-6 flex items-center justify-center border-2 border-white shadow-md"
                data-testid="text-cart-count"
              >
                {itemCount}
              </span>
            </div>
            <div className="flex flex-col items-start text-right">
              <span className="text-[10px] md:text-xs font-medium text-white/90">سلة التسوق ({itemCount})</span>
              <span className="text-xs md:text-sm font-black">{formatCurrency(state.subtotal)}</span>
            </div>
          </Button>
        </div>
      )}
      <Cart isOpen={showCart} onClose={() => setShowCart(false)} />
    </>
  );
}

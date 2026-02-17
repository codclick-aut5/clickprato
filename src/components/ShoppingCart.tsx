import React, { useState, useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { X, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getAllVariations } from "@/services/variationService";
import { Variation } from "@/types/menu";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

const ShoppingCart: React.FC = () => {
  const {
    cartItems,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    itemCount,
    appliedCoupon,
    setAppliedCoupon,
    discountAmount,
    finalTotal,
  } = useCart();
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationsLoading, setVariationsLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    const loadVariations = async () => {
      try {
        const allVariations = await getAllVariations();
        setVariations(allVariations);
      } catch (error) {
        console.error("Erro ao carregar variações:", error);
      } finally {
        setVariationsLoading(false);
      }
    };
    loadVariations();
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const { data: cupom, error } = await supabase.from("cupons" as any).select("*").ilike("nome", couponCode.trim()).maybeSingle();
      if (error || !cupom) {
        toast({ title: "Cupom não encontrado", variant: "destructive" });
        return;
      }
      setAppliedCoupon(cupom as any);
      toast({ title: "Cupom aplicado!" });
      setCouponCode("");
    } catch (error) {
      toast({ title: "Erro ao aplicar cupom", variant: "destructive" });
    } finally {
      setCouponLoading(false);
    }
  };

  const getVariationPrice = (variationId: string): number => {
    const variation = variations.find(v => v.id === variationId);
    return variation?.additionalPrice || 0;
  };

  const calculateItemTotal = (item: any): number => {
    // 1. Preço Base
    const basePrice = (item.isHalfPizza || !item.priceFrom) ? (item.price || 0) : 0;
    
    // 2. Soma das Variações
    let variationsTotal = 0;
    if (item.selectedVariations) {
      item.selectedVariations.forEach((group: any) => {
        group.variations?.forEach((v: any) => {
          const price = getVariationPrice(v.variationId);
          const multiplier = (item.isHalfPizza && v.halfSelection === "whole") ? 2 : 1;
          variationsTotal += price * (v.quantity || 1) * multiplier;
        });
      });
    }

    // 3. Soma da Borda (SEM DUPLICAR)
    const borderPrice = item.selectedBorder?.additionalPrice || 0;
    
    // O total da linha é: (Base + Variações + Borda) * Quantidade
    return (basePrice + variationsTotal + borderPrice) * item.quantity;
  };

  if (window.location.pathname === "/checkout") return null;

  return (
    <>
      <button className="fixed bottom-6 right-6 z-30 bg-brand p-4 rounded-full shadow-lg" onClick={() => setIsCartOpen(true)}>
        <div className="relative">
          <ShoppingBag className="h-6 w-6 text-white" />
          {itemCount > 0 && <span className="absolute -top-2 -right-2 bg-food-green text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{itemCount}</span>}
        </div>
      </button>

      <div className={cn("fixed inset-0 bg-black/50 z-40", isCartOpen ? "block" : "hidden")} onClick={() => setIsCartOpen(false)}></div>

      <div className={cn("fixed right-0 top-0 h-full w-full sm:w-96 bg-white z-50 p-6 shadow-xl overflow-y-auto transform transition-transform", isCartOpen ? "translate-x-0" : "translate-x-full")}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Seu Pedido</h2>
          <button onClick={() => setIsCartOpen(false)}><X className="h-6 w-6" /></button>
        </div>

        {cartItems.length === 0 ? (
          <p className="text-center text-gray-500 mt-10">Carrinho vazio</p>
        ) : (
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="border-b pb-4">
                <div className="flex justify-between font-medium">
                  <span>{item.name}</span>
                  <button onClick={() => removeFromCart(item.id)}><Trash2 className="h-4 w-4 text-gray-400" /></button>
                </div>
                {item.selectedBorder && (
                  <p className="text-xs text-gray-500">Borda: {item.selectedBorder.name} (+{formatCurrency(item.selectedBorder.additionalPrice)})</p>
                )}
                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center border rounded">
                    <button onClick={() => decreaseQuantity(item.id)} className="px-2">-</button>
                    <span className="px-2">{item.quantity}</span>
                    <button onClick={() => increaseQuantity(item.id)} className="px-2">+</button>
                  </div>
                  <span className="font-bold">{formatCurrency(calculateItemTotal(item))}</span>
                </div>
              </div>
            ))}
            
            <div className="pt-4 space-y-2">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(cartTotal)}</span></div>
              {appliedCoupon && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatCurrency(finalTotal)}</span></div>
              <Button className="w-full bg-food-green mt-4" onClick={() => { setIsCartOpen(false); navigate("/checkout"); }}>Finalizar Pedido</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ShoppingCart;

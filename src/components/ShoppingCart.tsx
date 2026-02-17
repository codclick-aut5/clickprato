import React, { useState, useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { X, Minus, Plus, ShoppingBag, Trash2, Tag } from "lucide-react";
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
      const { data: cupom, error } = await supabase
        .from("cupons" as any)
        .select("*")
        .ilike("nome", couponCode.trim())
        .maybeSingle();

      if (error || !cupom) {
        toast({ title: "Cupom inválido", variant: "destructive" });
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

  const getVariationName = (id: string) => variations.find(v => v.id === id)?.name || "...";
  const getVariationPrice = (id: string) => variations.find(v => v.id === id)?.additionalPrice || 0;

  const calculateItemTotal = (item: any): number => {
    const basePrice = item.price || 0;
    let extras = 0;
    if (item.selectedVariations) {
      item.selectedVariations.forEach((g: any) => {
        g.variations?.forEach((v: any) => {
          const price = getVariationPrice(v.variationId);
          const multiplier = (item.isHalfPizza && v.halfSelection === "whole") ? 2 : 1;
          extras += price * (v.quantity || 1) * multiplier;
        });
      });
    }
    const border = item.selectedBorder?.additionalPrice || 0;
    return (basePrice + extras + border) * item.quantity;
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

      <div className={cn("fixed inset-0 bg-black/50 z-40 transition-opacity", isCartOpen ? "opacity-100" : "opacity-0 pointer-events-none")} onClick={() => setIsCartOpen(false)}></div>

      <div className={cn("fixed right-0 top-0 h-full w-full sm:w-96 bg-white z-50 p-6 shadow-xl flex flex-col transform transition-transform duration-300", isCartOpen ? "translate-x-0" : "translate-x-full")}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold font-montserrat text-food-black">O Meu Pedido</h2>
          <button onClick={() => setIsCartOpen(false)}><X className="h-6 w-6 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {cartItems.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Carrinho vazio</div>
          ) : (
            <div className="space-y-6">
              {cartItems.map((item) => (
                <div key={item.id} className="border-b border-gray-100 pb-4">
                  <div className="flex justify-between">
                    <h3 className="font-semibold text-food-black">{item.name}</h3>
                    <button onClick={() => removeFromCart(item.id)}><Trash2 className="h-4 w-4 text-gray-300 hover:text-red-500" /></button>
                  </div>
                  
                  {/* Detalhes dos Adicionais */}
                  <div className="mt-1 space-y-1">
                    {item.selectedVariations?.map((g: any) => g.variations?.map((v: any) => (
                      <div key={v.variationId} className="text-xs text-gray-500 flex justify-between">
                        <span>• {getVariationName(v.variationId)}</span>
                        <span>+{formatCurrency(getVariationPrice(v.variationId) * (item.isHalfPizza && v.halfSelection === "whole" ? 2 : 1))}</span>
                      </div>
                    )))}
                    {item.selectedBorder && (
                      <div className="text-xs text-brand font-medium flex justify-between">
                        <span>• Borda: {item.selectedBorder.name}</span>
                        <span>+{formatCurrency(item.selectedBorder.additionalPrice)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button onClick={() => decreaseQuantity(item.id)} className="p-1 px-2"><Minus className="h-3 w-3" /></button>
                      <span className="px-2 text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => increaseQuantity(item.id)} className="p-1 px-2"><Plus className="h-3 w-3" /></button>
                    </div>
                    <span className="font-bold text-food-black">{formatCurrency(calculateItemTotal(item))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="mt-6 space-y-4 pt-4 border-t border-gray-100">
            {/* Campo de Cupom */}
            <div className="flex gap-2">
              <Input 
                placeholder="Código do Cupom" 
                value={couponCode} 
                onChange={(e) => setCouponCode(e.target.value)}
                className="h-10 text-sm"
                disabled={!!appliedCoupon}
              />
              {appliedCoupon ? (
                <Button variant="outline" size="sm" onClick={() => setAppliedCoupon(null)} className="text-red-500 border-red-200">Remover</Button>
              ) : (
                <Button size="sm" onClick={handleApplyCoupon} disabled={couponLoading} className="bg-brand">Aplicar</Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(cartTotal)}</span></div>
              {appliedCoupon && <div className="flex justify-between text-sm text-green-600"><span>Desconto</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold text-food-black"><span>Total</span><span>{formatCurrency(finalTotal)}</span></div>
            </div>

            <Button className="w-full bg-food-green py-6 text-lg font-bold shadow-md hover:bg-opacity-90" onClick={() => { setIsCartOpen(false); navigate("/checkout"); }}>
              Finalizar Pedido
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default ShoppingCart;

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
    if (!couponCode.trim()) {
      toast({ title: "Código inválido", description: "Digite um código de cupom", variant: "destructive" });
      return;
    }
    setCouponLoading(true);
    try {
      const { data: cupom, error } = await supabase
        .from("cupons" as any)
        .select("*")
        .ilike("nome", couponCode.trim())
        .maybeSingle();

      if (error || !cupom) {
        toast({ title: "Cupom não encontrado", description: "Código de cupom inválido", variant: "destructive" });
        return;
      }
      const cupomData = cupom as any;
      if (!cupomData.ativo) {
        toast({ title: "Cupom inativo", description: "Este cupom não está disponível", variant: "destructive" });
        return;
      }
      // Validação de datas e valores mínimos...
      if (cupomData.valor_minimo_pedido && cartTotal < cupomData.valor_minimo_pedido) {
        toast({ title: "Valor mínimo não atingido", description: `Mínimo de ${formatCurrency(cupomData.valor_minimo_pedido)}`, variant: "destructive" });
        return;
      }

      setAppliedCoupon({
        id: cupomData.id,
        nome: cupomData.nome,
        tipo: cupomData.tipo,
        valor: cupomData.valor,
        usos: cupomData.usos,
        limite_uso: cupomData.limite_uso,
        data_inicio: cupomData.data_inicio,
        data_fim: cupomData.data_fim,
      });
      toast({ title: "Cupom aplicado!" });
      setCouponCode("");
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao aplicar cupom", variant: "destructive" });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast({ title: "Cupom removido" });
  };

  const handleCheckout = () => {
    if (!currentUser) {
      toast({ title: "Login necessário", variant: "destructive" });
      setIsCartOpen(false);
      navigate("/login");
      return;
    }
    setIsCartOpen(false);
    navigate("/checkout");
  };

  const getVariationName = (variationId: string): string => {
    const variation = variations.find(v => v.id === variationId);
    return variation ? variation.name : (variationsLoading ? "..." : "");
  };

  const getVariationPrice = (variationId: string): number => {
    const variation = variations.find(v => v.id === variationId);
    return variation?.additionalPrice || 0;
  };

  const calculateVariationsTotal = (item: any): number => {
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
    if (item.selectedBorder?.additionalPrice) {
      variationsTotal += item.selectedBorder.additionalPrice;
    }
    return variationsTotal;
  };

  const calculateItemTotal = (item: any): number => {
    // CORREÇÃO: Usa o preço base do item e soma as variações (incluindo borda) de forma unificada
    const basePrice = (item.isHalfPizza || !item.priceFrom) ? (item.price || 0) : 0;
    const extras = calculateVariationsTotal(item);
    return (basePrice + extras) * item.quantity;
  };

  const getHalfSelectionLabel = (halfSelection?: string): string => {
    switch (halfSelection) {
      case "half1": return "(Metade 1)";
      case "half2": return "(Metade 2)";
      case "whole": return "(Inteira - 2x)";
      default: return "";
    }
  };

  if (window.location.pathname === "/checkout") return null;

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-30 bg-brand p-4 rounded-full shadow-lg hover:bg-brand-600 transition-all"
        onClick={() => setIsCartOpen(true)}
      >
        <div className="relative">
          <ShoppingBag className="h-6 w-6 text-white" />
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-food-green text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </div>
      </button>

      <div className={cn("fixed inset-0 bg-black/50 z-40 transition-opacity", isCartOpen ? "opacity-100" : "opacity-0 pointer-events-none")} onClick={() => setIsCartOpen(false)}></div>

      <div className={cn("fixed right-0 top-0 h-full w-full sm:w-96 bg-white z-50 p-6 shadow-xl overflow-y-auto transform transition-transform duration-300", isCartOpen ? "translate-x-0" : "translate-x-full")}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Seu Pedido</h2>
          <button onClick={() => setIsCartOpen(false)}><X className="h-6 w-6 text-gray-500" /></button>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <ShoppingBag className="h-16 w-16 mb-4 opacity-20" />
            <p>Carrinho vazio</p>
            <Button className="mt-6 bg-brand" onClick={() => setIsCartOpen(false)}>Ver Menu</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => {
                const variationsTotal = calculateVariationsTotal(item);
                const itemTotal = calculateItemTotal(item);
                return (
                  <div key={item.id} className="flex border-b pb-4">
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h3 className="font-medium">{item.name}</h3>
                        <button onClick={() => removeFromCart(item.id)}><Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" /></button>
                      </div>
                      
                      {item.isHalfPizza && item.combination && (
                        <div className="text-sm text-gray-600">
                          <p>1/2 {item.combination.sabor1.name} + 1/2 {item.combination.sabor2.name}</p>
                          <p className="font-medium text-brand">{formatCurrency(item.price)}</p>
                        </div>
                      )}

                      {/* Exibição de variações e borda */}
                      {(variationsTotal > 0) && (
                        <div className="mt-1 space-y-1">
                          {item.selectedVariations?.map((g:any) => g.variations.map((v:any) => (
                            <div key={v.variationId} className="text-xs text-gray-500 flex justify-between">
                              <span>{getVariationName(v.variationId)} {getHalfSelectionLabel(v.halfSelection)}</span>
                              <span>+{formatCurrency(getVariationPrice(v.variationId) * (item.isHalfPizza && v.halfSelection === "whole" ? 2 : 1))}</span>
                            </div>
                          )))}
                          {item.selectedBorder && (
                            <div className="text-xs text-gray-500 flex justify-between">
                              <span>Borda: {item.selectedBorder.name}</span>
                              <span>+{formatCurrency(item.selectedBorder.additionalPrice)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center mt-3">
                        <div className="flex items-center border rounded">
                          <button onClick={() => decreaseQuantity(item.id)} className="p-1"><Minus className="h-3 w-3" /></button>
                          <span className="px-2 text-sm">{item.quantity}</span>
                          <button onClick={() => increaseQuantity(item.id)} className="p-1"><Plus className="h-3 w-3" /></button>
                        </div>
                        <div className="ml-auto font-bold">{formatCurrency(itemTotal)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="border-t pt-4 space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Cupom" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={!!appliedCoupon} />
                {appliedCoupon ? <Button variant="outline" onClick={handleRemoveCoupon}>Remover</Button> : <Button onClick={handleApplyCoupon} disabled={couponLoading}>Aplicar</Button>}
              </div>
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(cartTotal)}</span></div>
                {appliedCoupon && <div className="flex justify-between text-green-600"><span>Desconto</span><span>-{formatCurrency(discountAmount)}</span></div>}
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatCurrency(finalTotal)}</span></div>
                <Button className="w-full bg-food-green mt-4" onClick={handleCheckout}>Finalizar Pedido</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ShoppingCart;

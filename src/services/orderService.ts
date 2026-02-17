import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, CreateOrderRequest, UpdateOrderRequest } from "@/types/order";
import { getAllVariations } from "@/services/variationService";
import { verificarFidelidade } from "@/services/fidelidadeService";

const ORDERS_COLLECTION = "orders";

// Remove undefined para compatibilidade com Firestore
const removeUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date || value instanceof Timestamp) return value;
  if (Array.isArray(value)) return value.map(removeUndefinedDeep).filter(v => v !== undefined);
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      const cleaned = removeUndefinedDeep(val);
      if (cleaned !== undefined) out[key] = cleaned;
    });
    return out;
  }
  return value;
};

const getVariationPrice = async (variationId: string): Promise<number> => {
  try {
    const variations = await getAllVariations();
    const variation = variations.find((v) => v.id === variationId);
    return variation?.additionalPrice || 0;
  } catch (error) {
    return 0;
  }
};

export const createOrder = async (orderData: CreateOrderRequest): Promise<Order> => {
  try {
    let totalGeralCalculado = 0;

    const orderItems = await Promise.all(
      orderData.items.map(async (item) => {
        const itemQty = item.quantity ?? 1;
        const isHalfPizza = !!item.isHalfPizza;

        // 1. Preço Base (Apenas a massa/recheio base)
        const baseUnitPrice = isHalfPizza
          ? (item.combination?.price ?? item.price ?? 0)
          : (item.priceFrom ? 0 : (item.price ?? 0));

        let itemSubtotal = baseUnitPrice * itemQty;

        // 2. Processar Variações (Adicionais de recheio)
        let processedVariations: any[] = [];
        if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
          for (const group of item.selectedVariations) {
            const variationsInGroup = [];
            for (const variation of (group.variations || [])) {
              const variationAny = variation as any;
              const variationId = variation.variationId ?? variationAny.id ?? null;
              
              let addPrice = variation.additionalPrice;
              if (addPrice === undefined && variationId) {
                addPrice = await getVariationPrice(String(variationId));
              }
              const price = addPrice ?? 0;
              const vQty = variation.quantity ?? 1;
              const halfSel = variationAny.halfSelection ?? null;
              
              // Multiplicador: se for meio a meio e a variação for na pizza "inteira" (ex: borda ou extra em ambas)
              const halfMultiplier = (isHalfPizza && halfSel === "whole") ? 2 : 1;
              
              itemSubtotal += (price * vQty * halfMultiplier * itemQty);

              variationsInGroup.push({
                variationId,
                quantity: vQty,
                name: variation.name || "",
                additionalPrice: price,
                halfSelection: halfSel,
              });
            }
            if (variationsInGroup.length > 0) {
              processedVariations.push({
                groupId: group.groupId,
                groupName: group.groupName,
                variations: variationsInGroup
              });
            }
          }
        }

        // 3. Processar Borda Recheada
        const selectedBorder = (item as any).selectedBorder;
        if (selectedBorder && selectedBorder.additionalPrice > 0) {
          // Soma o valor da borda ao subtotal do item
          itemSubtotal += (selectedBorder.additionalPrice * itemQty);
        }

        totalGeralCalculado += itemSubtotal;

        return removeUndefinedDeep({
          menuItemId: item.menuItemId ?? (item as any).id ?? null,
          name: item.name,
          price: baseUnitPrice, // Preço original para exibição
          quantity: itemQty,
          selectedVariations: processedVariations,
          isHalfPizza,
          combination: item.combination || null,
          selectedBorder: selectedBorder || null,
          subtotal: itemSubtotal, // Valor final (Pizza + Adicionais + Borda)
        });
      })
    );

    // Montagem do objeto final para o Firestore
    const orderToSave = removeUndefinedDeep({
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      address: orderData.address,
      paymentMethod: orderData.paymentMethod,
      observations: orderData.observations ?? "",
      items: orderItems,
      status: orderData.status ?? "pending",
      subtotal: orderData.subtotal ?? totalGeralCalculado,
      frete: orderData.frete ?? 0,
      total: orderData.total ?? (totalGeralCalculado + (orderData.frete ?? 0) - (orderData.discount ?? 0)),
      discount: orderData.discount ?? 0,
      couponCode: orderData.couponCode ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), orderToSave);

    return {
      id: docRef.id,
      ...orderToSave,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Order;
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    throw error;
  }
};

// Funções de busca e formatação permanecem as mesmas
export const getOrderById = async (orderId: string): Promise<Order | null> => {
  const orderRef = doc(db, ORDERS_COLLECTION, orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) return null;
  const data = orderSnap.data();
  return { id: orderSnap.id, ...data, createdAt: formatTimestamp(data.createdAt), updatedAt: formatTimestamp(data.updatedAt) } as Order;
};

const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === "string") return timestamp;
  if (timestamp.toDate) return timestamp.toDate().toISOString();
  return new Date().toISOString();
};

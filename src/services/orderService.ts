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

// Remove `undefined` de objetos/arrays (Firestore não aceita undefined)
const removeUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep).filter((v) => v !== undefined);
  }
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
    console.error("Erro ao obter preço da variação:", error);
    return 0;
  }
};

// --- FUNÇÕES DE EXPORTAÇÃO ---

export const createOrder = async (orderData: CreateOrderRequest): Promise<Order> => {
  try {
    let totalGeralCalculado = 0;

    const orderItems = await Promise.all(
      orderData.items.map(async (item) => {
        const itemQty = item.quantity ?? 1;
        const isHalfPizza = !!item.isHalfPizza;

        // Preço base da pizza (sem adicionais/borda)
        const baseUnitPrice = isHalfPizza
          ? (item.combination?.price ?? item.price ?? 0)
          : (item.priceFrom ? 0 : (item.price ?? 0));

        let itemSubtotal = baseUnitPrice * itemQty;

        // Variações e Adicionais
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

        // Borda Recheada (Soma apenas ao subtotal do item)
        const selectedBorder = (item as any).selectedBorder;
        if (selectedBorder && selectedBorder.additionalPrice > 0) {
          itemSubtotal += (selectedBorder.additionalPrice * itemQty);
        }

        totalGeralCalculado += itemSubtotal;

        return removeUndefinedDeep({
          menuItemId: item.menuItemId ?? (item as any).id ?? null,
          name: item.name,
          price: baseUnitPrice, 
          quantity: itemQty,
          selectedVariations: processedVariations,
          isHalfPizza,
          combination: item.combination || null,
          selectedBorder: selectedBorder || null,
          subtotal: itemSubtotal, 
        });
      })
    );

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

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return null;
    const data = orderSnap.data();
    return {
      id: orderSnap.id,
      ...data,
      createdAt: formatTimestamp(data.createdAt),
      updatedAt: formatTimestamp(data.updatedAt),
    } as Order;
  } catch (error) {
    throw error;
  }
};

export const getOrdersByPhone = async (phone: string): Promise<Order[]> => {
  const q = query(collection(db, ORDERS_COLLECTION), where("customerPhone", "==", phone), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: formatTimestamp(doc.data().createdAt),
    updatedAt: formatTimestamp(doc.data().updatedAt)
  })) as Order[];
};

export const getTodayOrders = async (status?: string): Promise<Order[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const q = query(collection(db, ORDERS_COLLECTION), where("createdAt", ">=", Timestamp.fromDate(today)), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  let orders = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: formatTimestamp(doc.data().createdAt),
    updatedAt: formatTimestamp(doc.data().updatedAt)
  })) as Order[];
  if (status && status !== "all") orders = orders.filter(o => o.status === status);
  return orders;
};

export const getOrdersByDateRange = async (startDate: Date, endDate: Date, status?: string): Promise<Order[]> => {
  const start = new Date(startDate); start.setHours(0,0,0,0);
  const end = new Date(endDate); end.setHours(23,59,59,999);
  const q = query(collection(db, ORDERS_COLLECTION), where("createdAt", ">=", Timestamp.fromDate(start)), where("createdAt", "<=", Timestamp.fromDate(end)), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  let orders = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: formatTimestamp(doc.data().createdAt),
    updatedAt: formatTimestamp(doc.data().updatedAt)
  })) as Order[];
  if (status && status !== "all") orders = orders.filter(o => o.status === status);
  return orders;
};

export const updateOrder = async (orderId: string, updates: UpdateOrderRequest): Promise<Order | null> => {
  const orderRef = doc(db, ORDERS_COLLECTION, orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) return null;
  const currentOrder = orderSnap.data() as Order;
  const previousStatus = currentOrder.status;
  await updateDoc(orderRef, { ...updates, updatedAt: new Date() });
  if (updates.status === "delivered" && previousStatus !== "delivered") {
    await verificarFidelidade(currentOrder.customerName || "", currentOrder.customerPhone || "", currentOrder.items || []);
  }
  return getOrderById(orderId);
};

const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === "string") return timestamp;
  if (timestamp.toDate) return timestamp.toDate().toISOString();
  return new Date().toISOString();
};

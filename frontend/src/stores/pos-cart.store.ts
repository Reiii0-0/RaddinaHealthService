import { create } from 'zustand';
import type {
  CartItemInputDto,
  DrugClassification,
  MedicineSummaryDto,
  MedicineUomDto,
  PaymentMethod,
  PricingTier,
} from '@shared/api-contracts';

export interface PosCartItem extends CartItemInputDto {
  medicineId: string;
  sku: string;
  name: string;
  medicineName: string;
  activeIngredient: string;
  baseUnit: string;
  classification: DrugClassification;
  totalActiveStockBaseUnit: number;
  uomUnitName: string;
  qtyInUom: number;
  multiplierToBase: number;
  sellingPriceRegular: number;
  sellingPricePartner: number;
  uomConversions: MedicineUomDto[];
  medicine: MedicineSummaryDto;
}

export interface PosCartState {
  pricingTier: PricingTier;
  customerName: string;
  paymentMethod: PaymentMethod;
  items: PosCartItem[];
  selectedIndex: number;
  setPricingTier: (tier: PricingTier) => void;
  togglePricingTier: () => void;
  setCustomerName: (name: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setSelectedIndex: (index: number) => void;
  selectNextItem: () => void;
  selectPrevItem: () => void;
  addItem: (medicine: MedicineSummaryDto, preferredUomName?: string, qty?: number) => void;
  updateItemQty: (medicineIdOrIndex: string | number, qtyInUom: number, uomUnitName?: string) => void;
  setItemUom: (medicineIdOrIndex: string | number, uomUnitName: string) => void;
  cycleItemUom: (medicineIdOrIndex?: string | number) => void;
  replaceItemWithSubstitute: (oldMedicineId: string, substituteMedicine: MedicineSummaryDto) => void;
  removeItem: (medicineIdOrIndex: string | number) => void;
  clearCart: () => void;
}

function resolveDefaultUom(
  medicine: MedicineSummaryDto,
  preferredUomName?: string,
): MedicineUomDto {
  const conversions = medicine.uomConversions ?? [];
  if (preferredUomName) {
    const matched = conversions.find(
      (u) => u.unitName.toLowerCase() === preferredUomName.toLowerCase(),
    );
    if (matched) {
      return matched;
    }
  }
  const baseMatched = conversions.find((u) => u.multiplierToBase === 1);
  if (baseMatched) {
    return baseMatched;
  }
  if (conversions.length > 0) {
    return conversions[0];
  }
  return {
    id: `${medicine.id}-base`,
    medicineId: medicine.id,
    unitName: medicine.baseUnit || 'Tablet',
    multiplierToBase: 1,
    sellingPriceRegular: 0,
    sellingPricePartner: 0,
    barcode: null,
  };
}

function findTargetIndex(
  items: PosCartItem[],
  medicineIdOrIndex: string | number | undefined,
  fallbackIndex: number,
  uomUnitName?: string,
): number {
  if (typeof medicineIdOrIndex === 'number') {
    return medicineIdOrIndex >= 0 && medicineIdOrIndex < items.length ? medicineIdOrIndex : -1;
  }
  if (typeof medicineIdOrIndex === 'string') {
    if (uomUnitName) {
      const exactIdx = items.findIndex(
        (item) => item.medicineId === medicineIdOrIndex && item.uomUnitName === uomUnitName,
      );
      if (exactIdx !== -1) {
        return exactIdx;
      }
    }
    return items.findIndex((item) => item.medicineId === medicineIdOrIndex);
  }
  return fallbackIndex >= 0 && fallbackIndex < items.length ? fallbackIndex : -1;
}

export const usePosCartStore = create<PosCartState>((set) => ({
  pricingTier: 'REGULAR',
  customerName: '',
  paymentMethod: 'CASH',
  items: [],
  selectedIndex: 0,

  setPricingTier: (tier) => set({ pricingTier: tier }),

  togglePricingTier: () =>
    set((state) => ({
      pricingTier: state.pricingTier === 'REGULAR' ? 'PARTNER' : 'REGULAR',
    })),

  setCustomerName: (name) => set({ customerName: name }),

  setPaymentMethod: (method) => set({ paymentMethod: method }),

  setSelectedIndex: (index) =>
    set((state) => ({
      selectedIndex:
        state.items.length === 0
          ? 0
          : Math.max(0, Math.min(index, state.items.length - 1)),
    })),

  selectNextItem: () =>
    set((state) => ({
      selectedIndex:
        state.items.length === 0
          ? 0
          : (state.selectedIndex + 1) % state.items.length,
    })),

  selectPrevItem: () =>
    set((state) => ({
      selectedIndex:
        state.items.length === 0
          ? 0
          : (state.selectedIndex - 1 + state.items.length) % state.items.length,
    })),

  addItem: (medicine, preferredUomName, qty = 1) =>
    set((state) => {
      const safeQty = Math.max(1, Math.trunc(qty));
      const existingIndex = state.items.findIndex((item) => item.medicineId === medicine.id);

      if (existingIndex !== -1) {
        const nextItems = [...state.items];
        const current = nextItems[existingIndex];
        const targetUom = preferredUomName
          ? resolveDefaultUom(medicine, preferredUomName)
          : resolveDefaultUom(medicine, current.uomUnitName);

        nextItems[existingIndex] = {
          ...current,
          uomUnitName: targetUom.unitName,
          multiplierToBase: targetUom.multiplierToBase,
          sellingPriceRegular: targetUom.sellingPriceRegular,
          sellingPricePartner: targetUom.sellingPricePartner,
          qtyInUom: current.qtyInUom + safeQty,
          medicine,
          uomConversions: medicine.uomConversions,
          totalActiveStockBaseUnit: medicine.totalActiveStockBaseUnit,
        };

        return {
          items: nextItems,
          selectedIndex: existingIndex,
        };
      }

      const defaultUom = resolveDefaultUom(medicine, preferredUomName);
      const newItem: PosCartItem = {
        medicineId: medicine.id,
        sku: medicine.sku,
        name: medicine.name,
        medicineName: medicine.name,
        activeIngredient: medicine.activeIngredient,
        baseUnit: medicine.baseUnit,
        classification: medicine.classification,
        totalActiveStockBaseUnit: medicine.totalActiveStockBaseUnit,
        uomUnitName: defaultUom.unitName,
        qtyInUom: safeQty,
        multiplierToBase: defaultUom.multiplierToBase,
        sellingPriceRegular: defaultUom.sellingPriceRegular,
        sellingPricePartner: defaultUom.sellingPricePartner,
        uomConversions: medicine.uomConversions ?? [defaultUom],
        medicine,
      };

      const nextItems = [...state.items, newItem];
      return {
        items: nextItems,
        selectedIndex: nextItems.length - 1,
      };
    }),

  updateItemQty: (medicineIdOrIndex, qtyInUom, uomUnitName) =>
    set((state) => {
      const targetIdx = findTargetIndex(
        state.items,
        medicineIdOrIndex,
        state.selectedIndex,
        uomUnitName,
      );
      if (targetIdx === -1) {
        return state;
      }

      const parsedQty = Math.trunc(qtyInUom);
      if (parsedQty <= 0) {
        const filtered = state.items.filter((_, idx) => idx !== targetIdx);
        return {
          items: filtered,
          selectedIndex:
            filtered.length === 0
              ? 0
              : Math.min(state.selectedIndex, filtered.length - 1),
        };
      }

      const nextItems = [...state.items];
      nextItems[targetIdx] = {
        ...nextItems[targetIdx],
        qtyInUom: parsedQty,
      };
      return { items: nextItems };
    }),

  setItemUom: (medicineIdOrIndex, uomUnitName) =>
    set((state) => {
      const targetIdx = findTargetIndex(state.items, medicineIdOrIndex, state.selectedIndex);
      if (targetIdx === -1) {
        return state;
      }

      const current = state.items[targetIdx];
      const matchedUom = current.uomConversions.find(
        (u) => u.unitName.toLowerCase() === uomUnitName.toLowerCase(),
      );
      if (!matchedUom) {
        return state;
      }

      const nextItems = [...state.items];
      nextItems[targetIdx] = {
        ...current,
        uomUnitName: matchedUom.unitName,
        multiplierToBase: matchedUom.multiplierToBase,
        sellingPriceRegular: matchedUom.sellingPriceRegular,
        sellingPricePartner: matchedUom.sellingPricePartner,
      };
      return { items: nextItems };
    }),

  cycleItemUom: (medicineIdOrIndex) =>
    set((state) => {
      const targetIdx = findTargetIndex(state.items, medicineIdOrIndex, state.selectedIndex);
      if (targetIdx === -1) {
        return state;
      }

      const current = state.items[targetIdx];
      const conversions = current.uomConversions;
      if (!conversions || conversions.length <= 1) {
        return state;
      }

      const currentUomIdx = conversions.findIndex(
        (u) => u.unitName.toLowerCase() === current.uomUnitName.toLowerCase(),
      );
      const nextUom = conversions[(currentUomIdx + 1) % conversions.length];

      const nextItems = [...state.items];
      nextItems[targetIdx] = {
        ...current,
        uomUnitName: nextUom.unitName,
        multiplierToBase: nextUom.multiplierToBase,
        sellingPriceRegular: nextUom.sellingPriceRegular,
        sellingPricePartner: nextUom.sellingPricePartner,
      };
      return {
        items: nextItems,
        selectedIndex: targetIdx,
      };
    }),

  replaceItemWithSubstitute: (oldMedicineId, substituteMedicine) =>
    set((state) => {
      const targetIdx = state.items.findIndex((item) => item.medicineId === oldMedicineId);
      const defaultUom = resolveDefaultUom(substituteMedicine);
      const replacement: PosCartItem = {
        medicineId: substituteMedicine.id,
        sku: substituteMedicine.sku,
        name: substituteMedicine.name,
        medicineName: substituteMedicine.name,
        activeIngredient: substituteMedicine.activeIngredient,
        baseUnit: substituteMedicine.baseUnit,
        classification: substituteMedicine.classification,
        totalActiveStockBaseUnit: substituteMedicine.totalActiveStockBaseUnit,
        uomUnitName: defaultUom.unitName,
        qtyInUom: targetIdx !== -1 ? state.items[targetIdx].qtyInUom : 1,
        multiplierToBase: defaultUom.multiplierToBase,
        sellingPriceRegular: defaultUom.sellingPriceRegular,
        sellingPricePartner: defaultUom.sellingPricePartner,
        uomConversions: substituteMedicine.uomConversions ?? [defaultUom],
        medicine: substituteMedicine,
      };

      if (targetIdx === -1) {
        const nextItems = [...state.items, replacement];
        return { items: nextItems, selectedIndex: nextItems.length - 1 };
      }

      const nextItems = [...state.items];
      nextItems[targetIdx] = replacement;
      return { items: nextItems, selectedIndex: targetIdx };
    }),

  removeItem: (medicineIdOrIndex) =>
    set((state) => {
      const targetIdx = findTargetIndex(state.items, medicineIdOrIndex, state.selectedIndex);
      if (targetIdx === -1) {
        return state;
      }
      const nextItems = state.items.filter((_, idx) => idx !== targetIdx);
      return {
        items: nextItems,
        selectedIndex:
          nextItems.length === 0
            ? 0
            : Math.min(state.selectedIndex, nextItems.length - 1),
      };
    }),

  clearCart: () =>
    set({
      items: [],
      selectedIndex: 0,
      customerName: '',
      paymentMethod: 'CASH',
    }),
}));

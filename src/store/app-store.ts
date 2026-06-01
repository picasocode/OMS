import { create } from 'zustand';

export type AppView =
  | 'dashboard'
  | 'new-order'
  | 'orders'
  | 'order-detail'
  | 'physicians'
  | 'sales-reps'
  | 'products'
  | 'discounts'
  | 'analytics';

interface AppState {
  currentView: AppView;
  selectedOrderId: string | null;
  selectedRepFilter: string | null; // null = all reps
  setCurrentView: (view: AppView) => void;
  setSelectedOrderId: (id: string | null) => void;
  setSelectedRepFilter: (repId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedOrderId: null,
  selectedRepFilter: null,
  setCurrentView: (view) => set({ currentView: view, selectedOrderId: view === 'order-detail' ? null : null }),
  setSelectedOrderId: (id) => set({ selectedOrderId: id, currentView: 'order-detail' }),
  setSelectedRepFilter: (repId) => set({ selectedRepFilter: repId }),
}));

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore, type UserRole } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import LoginForm from '@/components/login-form';
import TopNav from '@/components/top-nav';
import DashboardView from '@/components/dashboard/dashboard-view';
import NewOrderForm from '@/components/orders/new-order-form';
import OrderList from '@/components/orders/order-list';
import OrderDetail from '@/components/orders/order-detail';
import PhysiciansDirectory from '@/components/physicians/physicians-directory';
import SalesRepsManagement from '@/components/sales-reps-management';
import ProductsPricing from '@/components/products/products-pricing';
import DiscountCodes from '@/components/discounts/discount-codes';
import AnalyticsView from '@/components/analytics/analytics-view';

// Role-based access control for views
const ADMIN_ONLY_VIEWS = ['sales-reps', 'discounts', 'analytics'];
const ALL_VIEWS = ['dashboard', 'new-order', 'orders', 'order-detail', 'physicians', 'products', 'sales-reps', 'discounts', 'analytics'];

function isViewAllowed(view: string, role: UserRole): boolean {
  if (ADMIN_ONLY_VIEWS.includes(view) && role !== 'admin') return false;
  return ALL_VIEWS.includes(view);
}

function ViewRouter() {
  const { currentView } = useAppStore();
  const { user } = useAuthStore();

  // Role-based view guard: redirect sales_rep away from admin-only views
  const effectiveView = user && isViewAllowed(currentView, user.role) ? currentView : 'dashboard';

  switch (effectiveView) {
    case 'dashboard': return <DashboardView />;
    case 'new-order': return <NewOrderForm />;
    case 'orders': return <OrderList />;
    case 'order-detail': return <OrderDetail />;
    case 'physicians': return <PhysiciansDirectory />;
    case 'sales-reps': return <SalesRepsManagement />;
    case 'products': return <ProductsPricing />;
    case 'discounts': return <DiscountCodes />;
    case 'analytics': return <AnalyticsView />;
    default: return <DashboardView />;
  }
}

function AppContent() {
  const { isAuthenticated, isLoading, checkSession } = useAuthStore();

  // Check existing session on mount (cookie-based auth persistence)
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F3F3]">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-[#052093] rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3]">
      <TopNav />
      <main className="pt-20 px-4 pb-6 lg:px-6 lg:pt-20">
        <ViewRouter />
      </main>
    </div>
  );
}

export default function Home() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type AppView } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCircle,
  Package,
  Tag,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const repNavItems: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { view: 'orders', label: 'Orders', icon: <ClipboardList className="h-4 w-4" /> },
  { view: 'physicians', label: 'Physicians', icon: <UserCircle className="h-4 w-4" /> },
  { view: 'products', label: 'Products', icon: <Package className="h-4 w-4" /> },
];

const adminNavItems: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { view: 'orders', label: 'Orders', icon: <ClipboardList className="h-4 w-4" /> },
  { view: 'physicians', label: 'Physicians', icon: <UserCircle className="h-4 w-4" /> },
  { view: 'products', label: 'Products', icon: <Package className="h-4 w-4" /> },
  { view: 'sales-reps', label: 'Sales Reps', icon: <Users className="h-4 w-4" /> },
  { view: 'discounts', label: 'Discounts', icon: <Tag className="h-4 w-4" /> },
  { view: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
];

export default function TopNav() {
  const { user, logout } = useAuthStore();
  const { currentView, setCurrentView } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin ? adminNavItems : repNavItems;

  const handleNavClick = (view: AppView) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200" style={{ height: '64px' }}>
      <div className="max-w-full mx-auto px-4 flex items-center justify-between" style={{ height: '64px' }}>
        {/* Left: Logo + OMS */}
        <div className="flex items-center gap-3 shrink-0">
          <Image
            src="/biomedic-logo.jpg"
            alt="Biomedic Consulting"
            width={36}
            height={36}
            className="rounded"
            style={{ width: 'auto', height: 'auto' }}
          />
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-bold text-[#052093] text-lg leading-none">OMS</span>
            <span className="text-[#656565] text-xs leading-none">Order Management</span>
          </div>
        </div>

        {/* Center: Nav links (desktop) */}
        <div className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors relative',
                currentView === item.view
                  ? 'text-[#FF9700]'
                  : 'text-[#656565] hover:text-[#052093] hover:bg-gray-50'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              {currentView === item.view && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#FF9700] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Right: User info + Logout */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm font-medium text-[#111827]">{user?.name}</span>
            <Badge className={cn(
              'text-xs font-medium border-0',
              isAdmin ? 'bg-[#052093] text-white' : 'bg-[#FF9700] text-white'
            )}>
              {isAdmin ? 'Admin' : user?.territory}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="text-[#656565] hover:text-red-600 hover:bg-red-50 h-9 w-9"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown menu with backdrop */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop overlay */}
          <div
            className="lg:hidden fixed inset-0 bg-black/20 z-40"
            style={{ top: '64px' }}
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Menu panel */}
          <div className="lg:hidden bg-white border-b border-gray-200 shadow-lg relative z-50">
            <div className="px-4 py-2 space-y-1">
              {/* Mobile user info */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 mb-2">
                <div className="h-8 w-8 rounded-full bg-[#052093] flex items-center justify-center text-xs font-semibold text-white">
                  {user?.name?.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#111827]">{user?.name}</p>
                  <p className="text-xs text-[#656565]">{isAdmin ? 'Admin' : user?.territory}</p>
                </div>
              </div>
              {navItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => handleNavClick(item.view)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    currentView === item.view
                      ? 'bg-[#052093]/5 text-[#FF9700]'
                      : 'text-[#656565] hover:bg-gray-50 hover:text-[#052093]'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthUser } from '@/types';
import { apiGet } from '@/lib/api';

interface TopbarProps {
  user: AuthUser;
  onMobileMenuOpen: () => void;
}

interface DashboardStats {
  totalStores: number;
  totalProducts: number;
  pendingOrders: number;
  packedOrders: number;
  waitingRoutes: number;
  completedRoutes: number;
  waitingClaims: number;
  waitingQuestions: number;
}

export function Topbar({ user, onMobileMenuOpen }: TopbarProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiGet<DashboardStats>('/dashboard/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 shadow-sm">
      <button 
        className="md:hidden text-muted-foreground hover:text-foreground"
        onClick={onMobileMenuOpen}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1 overflow-x-auto">
        <div className="flex items-center space-x-2 lg:space-x-3 min-w-max">
          <Link
            href="/orders?status=PENDING"
            className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group shrink-0"
          >
            <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="hidden lg:inline text-sm font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">Paketlenmeyi Bekleyen</span>
            <span className="lg:hidden text-xs font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">Bekleyen</span>
            {stats !== null && (
              <span className="px-1.5 lg:px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 shrink-0">
                {stats.pendingOrders}
              </span>
            )}
          </Link>

          <Link
            href="/routes?status=COLLECTING"
            className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group shrink-0"
          >
            <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="hidden lg:inline text-sm font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">Toplamada Bekleyen</span>
            <span className="lg:hidden text-xs font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">Rota</span>
            {stats !== null && (
              <span className="px-1.5 lg:px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20 shrink-0">
                {stats.waitingRoutes}
              </span>
            )}
          </Link>

          <Link
            href="/claims"
            className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group shrink-0"
          >
            <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
            </svg>
            <span className="hidden lg:inline text-sm font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">İade Bekleyen</span>
            <span className="lg:hidden text-xs font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">İade</span>
            {stats !== null && (
              <span className="px-1.5 lg:px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-600 border border-red-500/20 shrink-0">
                {stats.waitingClaims}
              </span>
            )}
          </Link>

          <Link
            href="/questions"
            className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group shrink-0"
          >
            <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden lg:inline text-sm font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">Soru Bekleyen</span>
            <span className="lg:hidden text-xs font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap">Soru</span>
            {stats !== null && (
              <span className="px-1.5 lg:px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 shrink-0">
                {stats.waitingQuestions}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

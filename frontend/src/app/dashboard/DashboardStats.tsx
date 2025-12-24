'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { InfoCard } from '@/components/common/InfoCard';

interface DashboardInternalStats {
  totalStores: number;
  totalProducts: number;
  pendingOrders: number;
  packedOrders: number;
  waitingRoutes: number;
  completedRoutes: number;
  totalOrders: number;
  totalRevenue: number;
}

interface DashboardExternalStats {
  waitingClaims: number;
  waitingQuestions: number;
}

export function DashboardStats() {
  const [internalStats, setInternalStats] = useState<DashboardInternalStats | null>(null);
  const [externalStats, setExternalStats] = useState<DashboardExternalStats | null>(null);
  const [isLoadingInternal, setIsLoadingInternal] = useState(true);
  const [isLoadingExternal, setIsLoadingExternal] = useState(true);

  useEffect(() => {
    const fetchInternalStats = async () => {
      try {
        const response = await apiGet<DashboardInternalStats>('/dashboard/stats');
        setInternalStats(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard internal stats:', error);
      } finally {
        setIsLoadingInternal(false);
      }
    };

    const fetchExternalStats = async () => {
      try {
        const response = await apiGet<DashboardExternalStats>('/dashboard/external-stats');
        setExternalStats(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard external stats:', error);
      } finally {
        setIsLoadingExternal(false);
      }
    };

    fetchInternalStats();
    fetchExternalStats();
  }, []);

  if (isLoadingInternal && !internalStats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="bg-card p-6 rounded-xl border border-border shadow-sm animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2"></div>
            <div className="h-8 bg-muted rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <InfoCard
        title="Toplam Ciro"
        value={internalStats?.totalRevenue ? `${internalStats.totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : '0,00 ₺'}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <InfoCard
        title="Toplam Satış Adedi"
        value={internalStats?.totalOrders ?? 0}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
      />
      <InfoCard
        title="Toplam Mağaza Sayısı"
        value={internalStats?.totalStores ?? 0}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
      />
      <InfoCard
        title="Toplam Ürün"
        value={internalStats?.totalProducts ?? 0}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
      />
      <InfoCard
        title="Paketlenmeyi Bekleyen"
        value={internalStats?.pendingOrders ?? 0}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />
      <InfoCard
        title="Toplamada Rota"
        value={internalStats?.waitingRoutes ?? 0}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        }
      />
      <InfoCard
        title="Paketlenen"
        value={internalStats?.packedOrders ?? 0}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        }
      />
      <InfoCard
        title="Tamamlanan Rota"
        value={internalStats?.completedRoutes ?? 0}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <InfoCard
        title="İade Bekleyen"
        value={isLoadingExternal ? '...' : (externalStats?.waitingClaims ?? 0)}
        icon={
          <svg className={`w-5 h-5 ${isLoadingExternal ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
          </svg>
        }
      />
      <InfoCard
        title="Soru Bekleyen"
        value={isLoadingExternal ? '...' : (externalStats?.waitingQuestions ?? 0)}
        icon={
          <svg className={`w-5 h-5 ${isLoadingExternal ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}


import { Role, RouteConfig } from '@/types';

export const routes: RouteConfig[] = [
  {
    path: '/dashboard',
    label: 'Kontrol Paneli',
    icon: 'dashboard',
    roles: [Role.PLATFORM_OWNER],
    showInSidebar: true,
  },
  {
    path: '/stores',
    label: 'Mağazalar',
    icon: 'stores',
    roles: [Role.PLATFORM_OWNER],
    showInSidebar: true,
  },
  {
    path: '/products',
    label: 'Ürünler',
    icon: 'products',
    roles: [Role.PLATFORM_OWNER],
    showInSidebar: true,
  },
      {
        path: '/orders',
        label: 'Siparişler',
        icon: 'orders',
        roles: [Role.PLATFORM_OWNER],
        showInSidebar: true,
      },
      {
        path: '/test-order',
        label: 'Test Siparişi',
        icon: 'test-order',
        roles: [Role.PLATFORM_OWNER],
        showInSidebar: true,
      },
      {
        path: '/routes',
        label: 'Rotalar',
        icon: 'routes',
        roles: [Role.PLATFORM_OWNER],
        showInSidebar: true,
      },
      {
        path: '/claims',
        label: 'İade Yönetimi',
        icon: 'claims',
        roles: [Role.PLATFORM_OWNER, Role.OPERATION],
        showInSidebar: true,
      },
      {
        path: '/questions',
        label: 'Müşteri Soruları',
        icon: 'questions',
        roles: [Role.PLATFORM_OWNER, Role.OPERATION],
        showInSidebar: true,
      },
      {
        path: '/users',
    label: 'Kullanıcılar',
    icon: 'users',
    roles: [Role.PLATFORM_OWNER],
    showInSidebar: true,
  },
  {
    path: '/account',
    label: 'Hesap',
    icon: 'account',
    roles: [Role.PLATFORM_OWNER, Role.OPERATION],
    showInSidebar: true,
  },
];

export const publicRoutes = ['/auth/login'];

export const getRoutesByRole = (role: Role): RouteConfig[] => {
  return routes.filter((route) => route.roles.includes(role));
};

export const getSidebarRoutesByRole = (role: Role): RouteConfig[] => {
  return routes.filter(
    (route) => route.roles.includes(role) && route.showInSidebar
  );
};

export const isRouteAllowed = (path: string, role: Role): boolean => {
  const route = routes.find((r) => path.startsWith(r.path));
  if (!route) return false;
  return route.roles.includes(role);
};

export const getDefaultRouteByRole = (role: Role): string => {
  if (role === Role.PLATFORM_OWNER) {
    return '/dashboard';
  }
  return '/account';
};

import { Role, RouteConfig } from '@/types';

export const routes: RouteConfig[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    roles: [Role.PLATFORM_OWNER],
    showInSidebar: true,
  },
  {
    path: '/users',
    label: 'Users',
    icon: 'users',
    roles: [Role.PLATFORM_OWNER],
    showInSidebar: true,
  },
  {
    path: '/account',
    label: 'Account',
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

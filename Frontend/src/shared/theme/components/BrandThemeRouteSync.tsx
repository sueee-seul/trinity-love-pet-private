import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useBrandThemeStore } from '../themeStore';

/**
 * Keeps the default theme in step with the route for a visitor who has not chosen one.
 *
 * The store picks the right default on first load from `window.location`. This covers the moves
 * that happen without a reload, such as a manager signing in on `/login` and landing on `/admin`.
 * Renders nothing; it must sit inside the router.
 */
export const BrandThemeRouteSync: React.FC = () => {
  const { pathname } = useLocation();
  const syncRouteDefault = useBrandThemeStore((state) => state.syncRouteDefault);

  useEffect(() => {
    syncRouteDefault(pathname);
  }, [pathname, syncRouteDefault]);

  return null;
};

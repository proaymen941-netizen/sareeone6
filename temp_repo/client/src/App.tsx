import { Switch, Route, useLocation as useWouterLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "./context/CartContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LocationProvider, useUserLocation } from "./context/LocationContext";
import { UiSettingsProvider, useUiSettings } from "./context/UiSettingsContext";
import { NotificationProvider } from "./context/NotificationContext";
import { LocationPermissionModal } from "./components/LocationPermissionModal";
import Layout from "./components/Layout";
import FloatingCartNotification from "./components/FloatingCartNotification";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import DriverLoginPage from "./pages/driver/DriverLoginPage";
import AdminApp from "./pages/AdminApp";
import DriverAppPage from "./pages/driver/DriverApp";
import { useState, useEffect } from "react";
import { useSettingsSync } from "./hooks/useSettingsSync";
import { prefetchBootstrap } from "./lib/bootstrap";
import HomePage from "./pages/HomePage";
import RestaurantPage from "./pages/RestaurantPage";
import Cart from "./pages/Cart";
import Profile from "./pages/Profile";
import Location from "./pages/Location";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import OrdersPage from "./pages/OrdersPage";
import TrackOrdersPage from "./pages/TrackOrdersPage";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import SearchPage from "./pages/SearchPage";
// Admin pages removed - now handled separately
import NotFound from "@/pages/not-found";

import SplashScreen from "./components/SplashScreen";
import CitySelectionModal from "./components/CitySelectionModal";

import { androidBridge } from "./lib/androidBridge";

function MainApp() {
  useSettingsSync();
  const { getSetting } = useUiSettings();
  const { location: userLocation } = useUserLocation();
  const [currentLocation, setLocation] = useWouterLocation();
  const [showLocationModal, setShowLocationModal] = useState(() => {
    return localStorage.getItem('location_permission_granted') !== 'true';
  });
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem('splash_seen');
  });
  const [showCityModal, setShowCityModal] = useState(false);
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('is_guest') === 'true';
  });

  const isCitySelectionEnabled = getSetting('enable_city_selection') === 'true';

  // Trigger city selection modal ONLY on the first time if user has never selected a city
  useEffect(() => {
    if (!showSplash && isCitySelectionEnabled) {
      const selectedCity = localStorage.getItem('selected_city_name');
      const hasChosenEver = localStorage.getItem('city_chosen_first_time') === 'true';
      
      if (!selectedCity && !hasChosenEver) {
        setShowCityModal(true);
      }
    }
  }, [showSplash, isCitySelectionEnabled]);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsGuest(localStorage.getItem('is_guest') === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    handleStorageChange();
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentLocation]);

  const { isAuthenticated, user } = useAuth();

  // Auto-detect and route based on Native Android Bridge API Key or URL apiKey
  useEffect(() => {
    const key = androidBridge.getApiKey();
    if (key) {
      // Store key locally for subsequent API calls
      localStorage.setItem('saree_app_api_key', key);
      
      // If it is a driver key and currently on customer route, route to /driver seamlessly
      if (key.includes('driver') && !currentLocation.startsWith('/driver')) {
        setLocation('/driver');
      }
    }
  }, [currentLocation, setLocation]);

  // Register with Android Bridge if customer is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      if (androidBridge.isAvailable()) {
        androidBridge.registerCustomer(user.id);
        androidBridge.requestNotificationPermission(); // Ask for notification permission specifically on Android 13+
      }
    }
  }, [isAuthenticated, user?.id]);

  // Pre-warm caches on cold start (covers users who already saw splash this session)
  useEffect(() => {
    if (!showSplash) {
      const phone = user?.phone || localStorage.getItem('customer_phone') || '';
      const customerId = user?.id || '';
      prefetchBootstrap({ phone, customerId });
    }
  }, [showSplash, user?.id, user?.phone]);

  // Handle splash finish
  const handleSplashFinish = () => {
    sessionStorage.setItem('splash_seen', 'true');
    setShowSplash(false);
  };

  // If not authenticated and not guest, redirect to auth (unless already on auth or login pages)
  const isAuthPage = currentLocation === '/auth' || 
                     currentLocation === '/admin-login' || 
                     currentLocation === '/driver-login';

  const isAdminRoute = currentLocation.startsWith('/admin');
  const isDriverRoute = currentLocation.startsWith('/driver');
  const needsRedirectToAuth = !isAuthenticated && !isGuest && !isAuthPage && !isAdminRoute && !isDriverRoute;

  useEffect(() => {
    // لا تقم بالتحويل أو التوجيه إلا بعد اكتمال شاشة الترحيب (Splash Screen) بالكامل
    if (showSplash) return;

    if (needsRedirectToAuth) {
      setLocation('/auth');
    } else if (isAuthenticated && currentLocation === '/auth') {
      setLocation('/');
    }
  }, [showSplash, needsRedirectToAuth, isAuthenticated, isGuest, currentLocation, setLocation]);

  // عرض شاشة الترحيب (Splash Screen) حتى تكتمل كافة محتوياتها وعناصرها بالكامل
  if (showSplash && !isAdminRoute && !isDriverRoute) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (needsRedirectToAuth) {
    return null;
  }

  // Handle login pages first (without layout)
  if (currentLocation === '/admin-login') {
    return <AdminLoginPage />;
  }
  
  if (currentLocation === '/driver-login') {
    return <DriverLoginPage />;
  }

  // Handle admin routes - AdminApp handles its own AdminLayout internally
  if (currentLocation.startsWith('/admin')) {
    return <AdminApp />;
  }

  // Handle driver routes
  if (currentLocation.startsWith('/driver')) {
    return <DriverAppPage />;
  }

  // Default customer app
  return (
    <>
      <Layout>
        <Router />
      </Layout>
      <FloatingCartNotification />
      
      {showLocationModal && !userLocation.hasPermission && localStorage.getItem('location_permission_granted') !== 'true' && (
        <LocationPermissionModal
          onPermissionGranted={(position) => {
            localStorage.setItem('location_permission_granted', 'true');
            setShowLocationModal(false);
          }}
          onPermissionDenied={() => {
            sessionStorage.setItem('location_modal_dismissed', 'true');
            setShowLocationModal(false);
          }}
        />
      )}

      {/* City Selection Modal for Customer App */}
      <CitySelectionModal
        isOpen={showCityModal}
        onClose={() => setShowCityModal(false)}
        allowDismiss={Boolean(localStorage.getItem('selected_city_name'))}
      />
    </>
  );
}

import CategoryPage from "./pages/CategoryPage";
import ProductDetails from "./pages/ProductDetails";
import CustomerAuthPage from "./pages/CustomerAuthPage";
import Favorites from "./pages/Favorites";
import CustomerAddresses from "./pages/CustomerAddresses";
import WasalniPage from "./pages/WasalniPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage";
import AboutPage from "./pages/AboutPage";

function Router() {
  // Check UiSettings for page visibility
  const { isFeatureEnabled } = useUiSettings();
  const showOrdersPage = isFeatureEnabled('show_orders_page');
  const showTrackOrdersPage = isFeatureEnabled('show_track_orders_page');

  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/category/:slug" component={CategoryPage} />
      <Route path="/product/:id" component={ProductDetails} />
      <Route path="/restaurant/:id" component={RestaurantPage} />
      <Route path="/cart" component={Cart} />
      <Route path="/profile" component={Profile} />
      <Route path="/auth" component={CustomerAuthPage} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/addresses" component={Location} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/orders/:orderId" component={OrderTrackingPage} />
      {showTrackOrdersPage && <Route path="/track-orders" component={TrackOrdersPage} />}
      <Route path="/my-addresses" component={() => <CustomerAddresses userId="" />} />
      <Route path="/settings" component={Settings} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/wasalni" component={WasalniPage} />
      <Route path="/payment-methods" component={PaymentMethodsPage} />
      <Route path="/about" component={AboutPage} />
      
      {/* Authentication Routes */}
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/driver-login" component={DriverLoginPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

import { LanguageProvider } from "./context/LanguageContext";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <UiSettingsProvider>
                <LocationProvider>
                  <CartProvider>
                    <NotificationProvider>
                      <Toaster />
                      <MainApp />
                    </NotificationProvider>
                  </CartProvider>
                </LocationProvider>
              </UiSettingsProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

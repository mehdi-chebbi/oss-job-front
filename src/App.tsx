import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LoginModal from './components/LoginModal';
import HomePage from './pages/HomePage';
import OfferDetailPage from './pages/OfferDetailPage';
import AboutPage from './pages/AboutPage';
import AdminDashboard from './pages/AdminDashboard';
import ComiteAjoutDashboard from './pages/ComiteAjoutDashboard';
import ComiteOuvertureDashboard from './pages/ComiteOuvertureDashboard';
import OfferCreationPage from './pages/OfferCreationPage';
import OfferEditPage from './pages/OfferEditPage';
import type { Offer, User } from './types';
import { API_BASE_URL } from './config';
import { useI18n } from './i18n';

const LangLink = ({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) => {
  const { currentLangPrefix } = useI18n();
  const isAbsolute = to.startsWith('http');
  const path = isAbsolute ? to : `${currentLangPrefix}${to === '/' ? '' : to}` || '/';
  return (
    <Link to={path} className={className}>
      {children}
    </Link>
  );
};

// Component to handle root redirect based on browser language or default
const RootRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Get browser's preferred language
    const browserLang = navigator.language.toLowerCase();
    
    // Check if browser language is French
    const isFrench = browserLang.startsWith('fr');
    
    // Redirect to appropriate language
    const targetLang = isFrench ? '/fr' : '/en';
    navigate(targetLang, { replace: true });
  }, [navigate]);

  // Show loading while redirecting
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin h-12 w-12 border-t-2 border-green-600"></div>
    </div>
  );
};

const App = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const { t, currentLangPrefix } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/offers`);
        const data = await res.json();
        setOffers(data);
      } catch (err) {
        console.error('Failed to fetch offers:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role,
        });
      } catch {
        localStorage.removeItem('token');
      }
    }
    
    fetchOffers();
  }, []);
  
  const handleLogin = (userData: User) => {
    setUser(userData);
    setShowLogin(false);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Function to get dashboard route based on user and current language
  const getDashboardRoute = () => {
    if (!user) return currentLangPrefix || '/en';
    let dashboardPath;
    if (user.role === 'comite_ajout') {
      dashboardPath = '/comite-ajout-dashboard';
    } else if (user.role === 'comite_ouverture') {
      dashboardPath = '/comite-ouverture-dashboard';
    } else {
      dashboardPath = '/admin-dashboard';
    }
    return `${currentLangPrefix}${dashboardPath}`;
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-12 w-12 border-t-2 border-green-600"></div>
      </div>
    );
  }
  
  return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="bg-white shadow-lg border-b border-gray-200">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="w-full py-4 flex items-center justify-between">
              <LangLink 
                to={user ? (user.role === 'comite_ajout' ? '/comite-ajout-dashboard' : user.role === 'comite_ouverture' ? '/comite-ouverture-dashboard' : '/admin-dashboard') : '/'} 
                className="flex items-center group transition-all duration-200 hover:scale-105"
              >
               <div className="relative">
  <img 
    src="https://www.oss-online.org/sites/default/files/logo-h.png" 
    alt="OSS Logo" 
    className="h-12 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
  />
</div>

                <div className="ml-4">
                  <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {t('app.brand.title')}
                  </span>
                  <p className="text-sm text-gray-500 font-medium">{t('app.brand.subtitle')}</p>
                </div>
              </LangLink>
              
              <div className="flex items-center space-x-4">
                <LangLink
                  to="/about"
                  className="hidden sm:inline-flex items-center px-4 py-2 text-gray-700 hover:text-green-600 font-medium rounded-lg hover:bg-green-50 transition-colors duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('nav.about')}
                </LangLink>
                
                {user ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-sm font-medium text-gray-900">{t('nav.welcome')}</p>
                        <p className="text-sm text-gray-600 font-semibold">{user.name}</p>
                      </div>
                      <div className={`hidden sm:flex px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : user.role === 'comite_ajout'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'admin' ? t('role.admin') : user.role === 'comite_ajout' ? t('role.comite_ajout') : t('role.comite_ouverture')}
                      </div>
                    </div>
                    <button 
                      onClick={handleLogout} 
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {t('nav.logout')}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowLogin(true)} 
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7c1.13 0 2.08.402 2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('nav.login')}
                  </button>
                )}

                <button
                  onClick={() => {
                    const path = location.pathname;
                    if (path.startsWith('/fr')) {
                      const next = path.replace('/fr', '/en');
                      navigate(next || '/en');
                    } else if (path.startsWith('/en')) {
                      const next = path.replace('/en', '/fr');
                      navigate(next || '/fr');
                    } else {
                      // This case should not happen with our new routing, but just in case
                      navigate('/fr' + (path === '/' ? '' : path));
                    }
                  }}
                  className="inline-flex items-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
                >
                  {currentLangPrefix === '/fr' ? 'EN' : 'FR'}
                </button>
              </div>
            </div>
            
            <div className="sm:hidden border-t border-gray-100 py-2">
              <LangLink
                to="/about"
                className="flex items-center px-4 py-2 text-gray-700 hover:text-green-600 font-medium rounded-lg hover:bg-green-50 transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('nav.about')}
              </LangLink>
            </div>
            
            {user && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 border-t border-gray-100">
                <div className="flex items-center space-x-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 6h6" />
                  </svg>
                  <span className="text-gray-500">{t('nav.dashboard')}</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-gray-700 font-medium capitalize">
                    {user.role === 'admin' ? t('nav.admin') : t('nav.hr')}
                  </span>
                </div>
              </div>
            )}
          </nav>
        </header>
        
        <main className="flex-1">
          <Routes>
            {/* Root route - always redirect to language-specific route */}
            <Route path="/" element={<RootRedirect />} />
            
            {/* English routes */}
            <Route 
              path="/en" 
              element={
                user ? 
                <Navigate to={getDashboardRoute()} replace /> : 
                <HomePage offers={offers} />
              } 
            />
            <Route path="/en/about" element={<AboutPage />} />
            <Route path="/en/offer/:id" element={<OfferDetailPage />} />
            
            {/* French routes */}
            <Route 
              path="/fr" 
              element={
                user ? 
                <Navigate to={getDashboardRoute()} replace /> : 
                <HomePage offers={offers} />
              } 
            />
            <Route path="/fr/about" element={<AboutPage />} />
            <Route path="/fr/offer/:id" element={<OfferDetailPage />} />
            
            {/* Dashboard routes - only accessible when logged in */}
            {user?.role === 'comite_ajout' && (
              <>
                <Route path="/en/comite-ajout-dashboard" element={<ComiteAjoutDashboard />} />
                <Route path="/fr/comite-ajout-dashboard" element={<ComiteAjoutDashboard />} />
                <Route path="/en/create-offer" element={<OfferCreationPage />} />
                <Route path="/fr/create-offer" element={<OfferCreationPage />} />
                <Route path="/en/edit-offer/:id" element={<OfferEditPage />} />
                <Route path="/fr/edit-offer/:id" element={<OfferEditPage />} />
              </>
            )}
            {user?.role === 'comite_ouverture' && (
              <>
                <Route path="/en/comite-ouverture-dashboard" element={<ComiteOuvertureDashboard />} />
                <Route path="/fr/comite-ouverture-dashboard" element={<ComiteOuvertureDashboard />} />
              </>
            )}
            {user?.role === 'admin' && (
              <>
                <Route path="/en/admin-dashboard" element={<AdminDashboard />} />
                <Route path="/fr/admin-dashboard" element={<AdminDashboard />} />
              </>
            )}
            
            {/* Catch-all redirect - any unmatched route goes to appropriate language home */}
            <Route 
              path="*" 
              element={<Navigate to={currentLangPrefix || '/en'} replace />} 
            />
          </Routes>
        </main>
        
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">OSS</span>
                  </div>
                  <span className="ml-3 text-lg font-bold text-gray-900">{t('app.brand.title')}</span>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  {t('app.brand.subtitle')} - Connecting talent with opportunities across North Africa.
                </p>
                <div className="flex space-x-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.949 4.6 3.419-2.07 4.678-5.144 4.678-9.142 0-.185-.003-.37-.01-.552 2.179-1.397 4.768-2.348 4.768-2.348z"/>
                    </svg>
                  </div>
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors cursor-pointer">
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('footer.quickLinks')}</h3>
                <div className="space-y-2">
                  <LangLink to="/about" className="block text-gray-600 hover:text-green-600 transition-colors">{t('footer.about')}</LangLink>
                  <a href="#opportunities" className="block text-gray-600 hover:text-green-600 transition-colors">{t('footer.currentOpportunities')}</a>
                  <a href="#" className="block text-gray-600 hover:text-green-600 transition-colors">{t('footer.applicationProcess')}</a>
                  <a href="#" className="block text-gray-600 hover:text-green-600 transition-colors">{t('footer.contactUs')}</a>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('footer.contactInformation')}</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-600 text-sm">{t('footer.location')}</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 text-sm">careers@oss.org.tn</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <p className="text-gray-500 text-sm">
                  &copy; {new Date().getFullYear()} {t('app.brand.subtitle')}. {t('footer.copyright')}
                </p>
                <div className="flex space-x-6 mt-4 md:mt-0">
                  <a href="#" className="text-gray-500 hover:text-green-600 text-sm transition-colors">{t('footer.privacy')}</a>
                  <a href="#" className="text-gray-500 hover:text-green-600 text-sm transition-colors">{t('footer.terms')}</a>
                  <a href="#" className="text-gray-500 hover:text-green-600 text-sm transition-colors">{t('footer.accessibility')}</a>
                </div>
              </div>
            </div>
          </div>
        </footer>
        
        <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} onLogin={handleLogin} />
      </div>
  );
};

export default App;
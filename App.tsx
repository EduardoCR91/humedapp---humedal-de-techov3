
import React, { useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Monitoring from './components/Monitoring';
import Education from './components/Education';
import Participation from './components/Participation';
import Culture from './components/Culture';
import Chatbot from './components/Chatbot';
import { AppTab } from './types';
import { AuthProvider, useAuth } from './components/AuthContext';
import AuthScreen from './components/AuthScreen';
import UserProfilePanel from './components/UserProfilePanel';
import { Menu } from 'lucide-react';
import { NotificationProvider } from './components/NotificationContext';
import bgWetland from './imagenes/Comunitaria.jpg';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.HOME);
  const { user, loading } = useAuth();
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.HOME:
        return <Dashboard setActiveTab={setActiveTab} />;
      case AppTab.MONITORING:
        return user ? <Monitoring /> : <AuthScreen />;
      case AppTab.EDUCATION:
        return <Education />;
      case AppTab.PARTICIPATION:
        return user ? <Participation /> : <AuthScreen />;
      case AppTab.CULTURE:
        return <Culture />;
      case AppTab.CHAT:
        return <Chatbot />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f0] safe-area-bottom pb-20">
      <main
        className="max-w-md mx-auto min-h-screen relative overflow-x-hidden shadow-2xl rounded-none border border-emerald-900/20 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(129, 208, 187, 0.92), rgba(101, 177, 220, 0.9)), url(${bgWetland})`,
        }}
      >
        {user && (
          <div
            className="sticky top-0 z-30 px-4 pb-2 bg-gradient-to-b from-emerald-200/70 to-transparent"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
          >
            <div className="w-full flex items-center justify-between gap-3">
              <div className="bg-white/90 px-3 py-1.5 rounded-full shadow-sm border border-emerald-100 flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-emerald-800 tracking-tight">
                  EcoVigia!
                </span>
                <span className="w-px h-5 bg-emerald-100" />
                <img
                  src="/Logo-Pagina-Uniagustiniana.webp"
                  alt="Universidad Uniagustiniana"
                  className="h-6 md:h-7 object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowProfilePanel(true)}
                className="bg-white/90 backdrop-blur border border-emerald-100 shadow-md w-9 h-9 rounded-full flex items-center justify-center text-emerald-700 active:scale-95 transition-transform shrink-0"
                aria-label="Abrir menú de perfil"
                disabled={loading || !user}
              >
                <Menu size={18} />
              </button>
            </div>
          </div>
        )}
        <div>
          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">Cargando sesión...</div>
          ) : (
            renderContent()
          )}
        </div>
      </main>
      {showProfilePanel && <UserProfilePanel onClose={() => setShowProfilePanel(false)} />}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Global CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  </AuthProvider>
);

export default App;

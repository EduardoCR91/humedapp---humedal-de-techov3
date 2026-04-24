
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
    <div className="min-h-screen bg-[#dbe7df] safe-area-bottom pb-24">
      <main
        className="max-w-md mx-auto min-h-screen relative overflow-x-hidden shadow-2xl border border-emerald-900/20 bg-cover bg-center"
        style={{
          backgroundImage: `url('/ecovigia-wetland-bg.png')`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/30 via-transparent to-emerald-950/30" />
        {user && (
          <div
            className="sticky top-0 z-30 px-4 pb-2 bg-gradient-to-b from-white/35 via-white/15 to-transparent backdrop-blur-[1px]"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
          >
            <div className="w-full flex items-center justify-between gap-3">
              <div className="bg-white/85 px-3 py-1.5 rounded-full shadow-md border border-white/80 flex items-center gap-2 min-w-0 backdrop-blur-md">
                <span className="text-sm font-extrabold text-emerald-900 tracking-tight">
                  EcoVigia!
                </span>
                <span className="w-px h-5 bg-emerald-200" />
                <img
                  src="/Logo-Pagina-Uniagustiniana.webp"
                  alt="Universidad Uniagustiniana"
                  className="h-6 md:h-7 object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowProfilePanel(true)}
                className="bg-white/85 backdrop-blur-md border border-white/80 shadow-md w-11 h-11 rounded-full flex items-center justify-center text-emerald-800 active:scale-95 transition-transform shrink-0"
                aria-label="Abrir menú de perfil"
                disabled={loading || !user}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        )}
        <div className="relative z-10">
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
        .eco-card {
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(6px);
          box-shadow: 0 10px 28px rgba(15, 35, 26, 0.14);
        }
        .eco-card-soft {
          background: rgba(248, 252, 250, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(5px);
          box-shadow: 0 6px 20px rgba(15, 35, 26, 0.1);
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

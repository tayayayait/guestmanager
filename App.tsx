import React, { useState, useEffect } from 'react';
import Kiosk from './components/Kiosk';
import AdminDashboard from './components/AdminDashboard';
import { Settings } from 'lucide-react';

const parseBooleanEnv = (value?: string) =>
  value === '1' || value?.toLowerCase() === 'true';

const appEnv = (import.meta as any).env ?? {};
const ADMIN_PASSWORD = appEnv.VITE_ADMIN_PASSWORD || '0000';
const ADMIN_PASSWORD_BYPASS = parseBooleanEnv(appEnv.VITE_ADMIN_PASSWORD_BYPASS);

const App: React.FC = () => {
  // Simple hash-based routing for kiosk/admin views
  const [route, setRoute] = useState(window.location.hash || '#/');
  const [isAdminAuthed, setIsAdminAuthed] = useState(
    () => window.sessionStorage.getItem('centerflow_admin') === '1',
  );
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAdminButtonClick = () => {
    // If already on admin screen, toggle back to kiosk without asking password again
    if (route === '#/admin') {
      window.location.hash = '#/';
      return;
    }
    // From kiosk -> open password modal
    setShowAdminModal(true);
    setAdminError('');
    setAdminPasswordInput('');
  };

  const authenticateAdmin = () => {
    setIsAdminAuthed(true);
    window.sessionStorage.setItem('centerflow_admin', '1');
    setShowAdminModal(false);
    setAdminPasswordInput('');
    setAdminError('');
    window.location.hash = '#/admin';
  };

  const handleAdminLoginSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (ADMIN_PASSWORD_BYPASS) {
      authenticateAdmin();
      return;
    }
    if (!adminPasswordInput.trim()) {
      setAdminError('비밀번호를 입력해주세요.');
      return;
    }
    if (adminPasswordInput !== ADMIN_PASSWORD) {
      setAdminError('비밀번호가 올바르지 않습니다.');
      return;
    }
    // Success
    authenticateAdmin();
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminPasswordInput('');
    setAdminError('');
  };

  const content = route === '#/admin' && isAdminAuthed ? <AdminDashboard /> : <Kiosk />;

  return (
    <div className="relative">
      {/* Admin button in bottom-right corner */}
      <button
        onClick={handleAdminButtonClick}
        className="fixed bottom-4 right-4 z-40 p-2 text-gray-700 hover:text-gray-900 transition-colors opacity-90 hover:opacity-100"
        title="관리자 모드"
      >
        <Settings size={20} />
      </button>

      {content}

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">
              관리자 비밀번호 입력
            </h2>
            <p className="text-xs text-gray-500 mb-4 text-center">
              센터 운영자용 화면입니다. 비밀번호를 입력하면 관리자 대시보드로 이동합니다.
            </p>
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                placeholder="관리자 비밀번호"
                autoFocus
              />
              {adminError && (
                <p className="text-xs text-red-500 text-center">
                  {adminError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeAdminModal}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:scale-95 transition-all"
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

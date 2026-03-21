import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, Home, PiggyBank, X, Settings2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/salary', icon: Wallet, label: 'משכורות' },
  { to: '/expenses', icon: CreditCard, label: 'הוצאות' },
  { to: '/house', icon: Home, label: 'תקציב בית' },
  { to: '/savings', icon: PiggyBank, label: 'חיסכון' },
  { to: '/config', icon: Settings2, label: 'הגדרות' },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 right-0 z-30 h-full bg-white border-l border-gray-200 shadow-lg
          transition-transform duration-300 ease-in-out
          w-64 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0 lg:static lg:shadow-none lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Home size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 leading-tight">
              תקציב<br />משפחתי
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="סגור תפריט"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">מנהל תקציב משפחתי v1.0</p>
        </div>
      </aside>
    </>
  );
}

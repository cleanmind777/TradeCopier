import React from 'react';
import { Home, Users, BarChart3, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const AdminSidebar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    // { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
    // { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="w-72 bg-gradient-to-b from-white to-slate-50 border-r border-slate-100 min-h-screen flex flex-col shadow-sm">
      {/* Logo Section */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <img src='/logo.svg' className="h-10 w-10 rounded-lg shadow-sm" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
            <p className="text-xs text-slate-400 mt-1">v1.0.0</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.path)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${isActive(item.path)
                ? 'bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                } hover:shadow-sm active:scale-95`}
            >
              <Icon className={`h-5 w-5 ${isActive(item.path) ? 'text-blue-600' : 'text-slate-400'
                }`} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-700 transition-all duration-200 hover:shadow-sm active:scale-95"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
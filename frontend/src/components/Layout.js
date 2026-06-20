import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Search, LayoutDashboard, Wrench, Users, Package, LogOut, Menu, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', testId: 'nav-dashboard' },
    { path: '/repairs', icon: Wrench, label: 'Reparaciones', testId: 'nav-repairs' },
    { path: '/customers', icon: Users, label: 'Clientes', testId: 'nav-customers' },
    { path: '/inventory', icon: Package, label: 'Inventario', testId: 'nav-inventory' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/repairs?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100">
      <aside className={`fixed top-0 left-0 h-full bg-zinc-900 text-white w-64 z-40 transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="app-logo">ServiceTech</h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider">Sistema de Gestión</p>
        </div>
        
        <nav className="mt-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={item.testId}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-zinc-800 text-white border-l-4 border-blue-600' 
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center text-sm font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="user-name">{user?.name}</p>
              <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:ml-64">
        <header className="sticky top-0 z-20 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-4 px-4 py-3 md:px-8">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-zinc-100 rounded-md"
              data-testid="menu-toggle"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <form onSubmit={handleSearch} className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <Input
                  type="text"
                  placeholder="Buscar por IMEI, ticket, cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-50 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  data-testid="global-search-input"
                />
              </div>
            </form>

            <Button
              onClick={() => navigate('/repairs/new')}
              className="bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-md"
              data-testid="new-repair-button-header"
            >
              <Plus size={18} className="mr-2" />
              <span className="hidden sm:inline">Nueva Reparación</span>
              <span className="sm:hidden">Nueva</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="w-9 h-9 rounded-md bg-zinc-100 flex items-center justify-center text-sm font-semibold hover:bg-zinc-200 transition-colors"
                  data-testid="user-menu-trigger"
                >
                  {user?.name?.charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-zinc-500">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="logout-button">
                  <LogOut size={16} className="mr-2" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Billing from '@/pages/Billing';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Repairs from '@/pages/Repairs';
import RepairDetail from '@/pages/RepairDetail';
import NewRepair from '@/pages/NewRepair';
import Customers from '@/pages/Customers';
import CustomerDetail from '@/pages/CustomerDetail';
import Inventory from '@/pages/Inventory';
import Sales from '@/pages/Sales';
import Team from '@/pages/Team';
import PrintLabel from '@/pages/PrintLabel';
import PublicRepairView from '@/pages/PublicRepairView';
import Settings from '@/pages/Settings';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import '@/App.css';

const SubscriptionGate = ({ children }) => {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading');
  const billingPage = location.pathname === '/billing';
  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const { data } = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/billing`, { headers: { Authorization: `Bearer ${token}` } });
        if (live) setState(data.active ? 'active' : 'expired');
      } catch { if (live) setState('error'); }
    };
    // Keep the current page mounted while navigation checks run in the background.
    if (!billingPage) check();
    const timer = billingPage ? null : setInterval(check, 60000);
    const interceptor = axios.interceptors.response.use(response => response, error => {
      if (error.response?.status === 402 && !billingPage) {
        if (user?.role === 'admin') navigate('/billing', { replace: true });
        else setState('expired');
      }
      return Promise.reject(error);
    });
    return () => { live = false; clearInterval(timer); axios.interceptors.response.eject(interceptor); };
  }, [token, location.pathname, billingPage, navigate, user?.role]);
  if (billingPage) return children;
  if (state === 'loading') return null;
  if (state === 'error') return <div className="p-8">No se pudo verificar el acceso. <button onClick={() => window.location.reload()}>Reintentar</button></div>;
  if (state === 'expired') return user?.role === 'admin'
    ? <Navigate to="/billing" replace />
    : <div className="p-8">La suscripción está vencida. Pide al administrador que la renueve.</div>;
  return children;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading, token, authError, restoreSession } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-zinc-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (authError && token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-950">
        <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-700 dark:text-zinc-200">{authError}</p>
          <Button type="button" onClick={restoreSession} className="mt-4">Reintentar conexión</Button>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <SubscriptionGate>{children}</SubscriptionGate>;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === "admin" ? children : <Navigate to="/work-orders" replace />;
};

const TechnicianRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === "technician" ? children : <Navigate to="/" replace />;
};

const HomeRoute = () => {
  const { user } = useAuth();
  return user?.role === 'technician' ? <Navigate to="/work-orders" replace /> : <Dashboard />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/public/:ticketNumber" element={<PublicRepairView />} />
          <Route path="/print-label/:id" element={<ProtectedRoute><AdminRoute><PrintLabel /></AdminRoute></ProtectedRoute>} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="billing" element={<AdminRoute><Billing /></AdminRoute>} />
            <Route index element={<HomeRoute />} />
            <Route path="work-orders" element={<TechnicianRoute><Repairs scope="work" /></TechnicianRoute>} />
            <Route path="work-history" element={<TechnicianRoute><Repairs scope="history" /></TechnicianRoute>} />
            <Route path="repairs" element={<AdminRoute><Repairs /></AdminRoute>} />
            <Route path="repairs/new" element={<AdminRoute><NewRepair /></AdminRoute>} />
            <Route path="repairs/:id" element={<RepairDetail />} />
            <Route path="customers" element={<AdminRoute><Customers /></AdminRoute>} />
            <Route path="customers/:id" element={<AdminRoute><CustomerDetail /></AdminRoute>} />
            <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
            <Route path="inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
            <Route path="sales" element={<AdminRoute><Sales /></AdminRoute>} />
            <Route path="team" element={<AdminRoute><Team /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;

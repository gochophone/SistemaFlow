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
import Inventory from '@/pages/Inventory';
import Team from '@/pages/Team';
import PrintLabel from '@/pages/PrintLabel';
import PublicRepairView from '@/pages/PublicRepairView';
import Layout from '@/components/Layout';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import '@/App.css';

const SubscriptionGate = ({ children }) => {
  const { token } = useAuth();
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
    setState('loading');
    if (!billingPage) check();
    const timer = billingPage ? null : setInterval(check, 60000);
    const interceptor = axios.interceptors.response.use(response => response, error => {
      if (error.response?.status === 402 && !billingPage) navigate('/billing', { replace: true });
      return Promise.reject(error);
    });
    return () => { live = false; clearInterval(timer); axios.interceptors.response.eject(interceptor); };
  }, [token, location.pathname, billingPage, navigate]);
  if (billingPage) return children;
  if (state === 'loading') return <p className="p-8">Verificando acceso…</p>;
  if (state === 'error') return <div className="p-8">No se pudo verificar el acceso. <button onClick={() => window.location.reload()}>Reintentar</button></div>;
  if (state === 'expired') return <Navigate to="/billing" replace />;
  return children;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
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
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <SubscriptionGate>{children}</SubscriptionGate>;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === "admin" ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/public/:ticketNumber" element={<PublicRepairView />} />
          <Route path="/print-label/:id" element={<ProtectedRoute><PrintLabel /></ProtectedRoute>} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="billing" element={<Billing />} />
            <Route index element={<Dashboard />} />
            <Route path="repairs" element={<Repairs />} />
            <Route path="repairs/new" element={<NewRepair />} />
            <Route path="repairs/:id" element={<RepairDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
            <Route path="team" element={<AdminRoute><Team /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;

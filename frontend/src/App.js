import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Repairs from '@/pages/Repairs';
import RepairDetail from '@/pages/RepairDetail';
import NewRepair from '@/pages/NewRepair';
import Customers from '@/pages/Customers';
import Inventory from '@/pages/Inventory';
import PrintLabel from '@/pages/PrintLabel';
import PublicRepairView from '@/pages/PublicRepairView';
import Layout from '@/components/Layout';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import '@/App.css';

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
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/public/:ticketNumber" element={<PublicRepairView />} />
          <Route path="/print-label/:id" element={<PrintLabel />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="repairs" element={<Repairs />} />
            <Route path="repairs/new" element={<NewRepair />} />
            <Route path="repairs/:id" element={<RepairDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="inventory" element={<Inventory />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;

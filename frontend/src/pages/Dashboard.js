import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Wrench, Clock, CheckCircle, Package, TrendingUp } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  received: '#F59E0B',
  diagnosis: '#8B5CF6',
  in_repair: '#2563EB',
  completed: '#10B981',
  delivered: '#059669',
};

const Dashboard = () => {
  const { getAuthHeader } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API}/api/dashboard/stats`, {
          headers: getAuthHeader()
        });
        setStats(response.data);
      } catch (error) {
        console.error('Error al cargar estadísticas:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statusPieData = Object.entries(stats?.repairs_by_status || {}).map(([status, count]) => ({
    name: status === 'received' ? 'Recibido' :
          status === 'diagnosis' ? 'Diagnóstico' :
          status === 'in_repair' ? 'En Reparación' :
          status === 'completed' ? 'Completado' : 'Entregado',
    value: count,
    color: STATUS_COLORS[status] || '#94A3B8'
  }));

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-600 mt-1 uppercase tracking-wider">Visión general del servicio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-white border border-zinc-200 shadow-sm" data-testid="stat-card-total-repairs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Wrench className="text-blue-600" size={24} strokeWidth={1.5} />
              <p className="text-xs uppercase tracking-wider text-zinc-500">Total</p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{stats?.total_repairs || 0}</p>
            <p className="text-sm text-zinc-600 mt-1">Reparaciones</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm" data-testid="stat-card-active-repairs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Clock className="text-purple-600" size={24} strokeWidth={1.5} />
              <p className="text-xs uppercase tracking-wider text-zinc-500">Activas</p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{stats?.active_repairs || 0}</p>
            <p className="text-sm text-zinc-600 mt-1">En Proceso</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm" data-testid="stat-card-completed-today">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CheckCircle className="text-green-600" size={24} strokeWidth={1.5} />
              <p className="text-xs uppercase tracking-wider text-zinc-500">Hoy</p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{stats?.completed_today || 0}</p>
            <p className="text-sm text-zinc-600 mt-1">Completadas</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm" data-testid="stat-card-pending-delivery">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <TrendingUp className="text-amber-600" size={24} strokeWidth={1.5} />
              <p className="text-xs uppercase tracking-wider text-zinc-500">Pendiente</p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{stats?.pending_delivery || 0}</p>
            <p className="text-sm text-zinc-600 mt-1">Por Entregar</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm" data-testid="stat-card-low-stock">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Package className="text-red-600" size={24} strokeWidth={1.5} />
              <p className="text-xs uppercase tracking-wider text-zinc-500">Stock</p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-zinc-900">{stats?.low_stock_items || 0}</p>
            <p className="text-sm text-zinc-600 mt-1">Bajo Stock</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Reparaciones por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Reparaciones Últimos 7 Días</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.weekly_repairs || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis dataKey="date" stroke="#71717A" style={{ fontSize: '12px' }} />
                <YAxis stroke="#71717A" style={{ fontSize: '12px' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

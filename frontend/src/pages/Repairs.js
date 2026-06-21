import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  received: { label: 'Recibido', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  diagnosis: { label: 'Diagnóstico', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  in_repair: { label: 'En Reparación', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'Completado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 border-green-200' },
};

const Repairs = () => {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  const [repairs, setRepairs] = useState([]);
  const [filteredRepairs, setFilteredRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchRepairs();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery);
    } else {
      applyStatusFilter();
    }
  }, [repairs, statusFilter, searchQuery]);

  const fetchRepairs = async () => {
    try {
      const response = await axios.get(`${API}/repairs`, {
        headers: getAuthHeader()
      });
      setRepairs(response.data);
    } catch (error) {
      toast.error('Error al cargar reparaciones');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = (query) => {
    const lowerQuery = query.toLowerCase();
    const filtered = repairs.filter(repair => 
      repair.ticket_number.toLowerCase().includes(lowerQuery) ||
      repair.device_imei.toLowerCase().includes(lowerQuery) ||
      repair.customer_name.toLowerCase().includes(lowerQuery) ||
      repair.device_brand.toLowerCase().includes(lowerQuery) ||
      repair.device_model.toLowerCase().includes(lowerQuery)
    );
    setFilteredRepairs(filtered);
  };

  const applyStatusFilter = () => {
    if (statusFilter === 'all') {
      setFilteredRepairs(repairs);
    } else {
      setFilteredRepairs(repairs.filter(r => r.status === statusFilter));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="repairs-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Reparaciones</h1>
          <p className="text-sm text-zinc-600 mt-1 uppercase tracking-wider">
            {filteredRepairs.length} {filteredRepairs.length === 1 ? 'orden' : 'órdenes'}
            {searchQuery && ` - Buscando: "${searchQuery}"`}
          </p>
        </div>
        <Button
          onClick={() => navigate('/repairs/new')}
          className="bg-blue-600 text-white hover:bg-blue-700 font-medium"
          data-testid="new-repair-button"
        >
          <Plus size={18} className="mr-2" />
          Nueva Reparación
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
          size="sm"
          data-testid="filter-all"
        >
          Todas ({repairs.length})
        </Button>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = repairs.filter(r => r.status === status).length;
          return (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => setStatusFilter(status)}
              size="sm"
              data-testid={`filter-${status}`}
            >
              {config.label} ({count})
            </Button>
          );
        })}
      </div>

      <div className="bg-white border border-zinc-200 rounded-md shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50">
              <TableHead className="font-semibold text-zinc-900">Ticket</TableHead>
              <TableHead className="font-semibold text-zinc-900">Cliente</TableHead>
              <TableHead className="font-semibold text-zinc-900">Equipo</TableHead>
              <TableHead className="font-semibold text-zinc-900">IMEI</TableHead>
              <TableHead className="font-semibold text-zinc-900">Estado</TableHead>
              <TableHead className="font-semibold text-zinc-900">Fecha</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-zinc-500">
                  {searchQuery ? 'No se encontraron resultados' : 'No hay reparaciones registradas'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRepairs.map((repair) => (
                <TableRow 
                  key={repair.id} 
                  className="hover:bg-zinc-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/repairs/${repair.id}`)}
                  data-testid={`repair-row-${repair.ticket_number}`}
                >
                  <TableCell className="font-medium">{repair.ticket_number}</TableCell>
                  <TableCell>{repair.customer_name}</TableCell>
                  <TableCell>{repair.device_brand} {repair.device_model}</TableCell>
                  <TableCell className="font-mono text-xs">{repair.device_imei}</TableCell>
                  <TableCell>
                    <Badge 
                      className={`${STATUS_CONFIG[repair.status]?.color} border font-medium`}
                      data-testid={`status-badge-${repair.status}`}
                    >
                      {STATUS_CONFIG[repair.status]?.label || repair.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600">{formatDate(repair.received_date)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/repairs/${repair.id}`);
                      }}
                      data-testid={`view-repair-${repair.ticket_number}`}
                    >
                      <Eye size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Repairs;

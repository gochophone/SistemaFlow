import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Eye, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  not_repaired: { label: 'Sin reparación', color: 'bg-red-100 text-red-800 border-red-200' },
  received: { label: 'Recibido', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  diagnosis: { label: 'Diagnóstico', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  in_repair: { label: 'En Reparación', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'Completado', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 border-green-200' },
};

const TERMINAL_STATUSES = new Set(['delivered', 'not_repaired']);
const isUnpaidDelivered = (repair) => repair.status === 'delivered' && !repair.paid;

const confirmTerminalStatus = (status) => {
  if (!TERMINAL_STATUSES.has(status)) return true;
  const label = STATUS_CONFIG[status].label;
  return window.confirm(`¿Confirmas cambiar la orden a ${label}? Después de aceptar no podrás modificar nuevamente su estado.`);
};

const Repairs = () => {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  const customerFilter = searchParams.get('customer_id') || '';
  const [repairs, setRepairs] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [savingStatusId, setSavingStatusId] = useState(null);
  const [savingPaymentId, setSavingPaymentId] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const headers = getAuthHeader();
    Promise.all([
      axios.get(`${API}/api/repairs`, {
        headers, ...(customerFilter ? { params: { customer_id: customerFilter } } : {}),
      }),
      customerFilter
        ? axios.get(`${API}/api/customers/${encodeURIComponent(customerFilter)}`, { headers }).catch(() => null)
        : Promise.resolve(null),
    ]).then(([repairResponse, customerResponse]) => {
      if (!live) return;
      setRepairs(repairResponse.data);
      setCustomerName(customerResponse?.data?.name || repairResponse.data[0]?.customer_name || 'este cliente');
    }).catch((error) => {
      if (live) toast.error(error.response?.data?.detail || 'Error al cargar reparaciones');
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerFilter]);

  const unpaidCount = repairs.filter(isUnpaidDelivered).length;
  const normalizedSearch = (searchQuery || '').trim().toLowerCase();
  const filteredRepairs = repairs.filter((repair) => {
    const matchesFilter = statusFilter === 'unpaid'
      ? isUnpaidDelivered(repair)
      : statusFilter === 'all' || repair.status === statusFilter;
    const matchesSearch = !normalizedSearch || [
      repair.ticket_number, repair.device_imei, repair.customer_name,
      repair.device_brand, repair.device_model,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleStatusChange = async (repair, status) => {
    if (status === repair.status || savingStatusId === repair.id) return;
    if (TERMINAL_STATUSES.has(repair.status)) {
      toast.error(`El estado ${STATUS_CONFIG[repair.status].label} es definitivo y está bloqueado.`);
      return;
    }
    if (!confirmTerminalStatus(status)) return;

    const previousStatus = repair.status;
    setSavingStatusId(repair.id);
    setRepairs((current) => current.map((item) => item.id === repair.id ? { ...item, status } : item));

    try {
      const { data } = await axios.patch(`${API}/api/repairs/${repair.id}`, { status }, {
        headers: getAuthHeader()
      });
      setRepairs((current) => current.map((item) => item.id === repair.id ? data : item));
      toast.success(`Estado cambiado a ${STATUS_CONFIG[status]?.label || status}`);
    } catch (error) {
      setRepairs((current) => current.map((item) => item.id === repair.id ? { ...item, status: previousStatus } : item));
      toast.error(error.response?.data?.detail || 'No se pudo cambiar el estado');
    } finally {
      setSavingStatusId(null);
    }
  };

  const handlePaymentChange = async (repair, paid) => {
    if (repair.status !== 'delivered' || savingPaymentId === repair.id) return;

    const previousPaid = Boolean(repair.paid);
    setSavingPaymentId(repair.id);
    setRepairs((current) => current.map((item) => item.id === repair.id ? { ...item, paid } : item));

    try {
      const { data } = await axios.patch(`${API}/api/repairs/${repair.id}`, { paid }, {
        headers: getAuthHeader()
      });
      setRepairs((current) => current.map((item) => item.id === repair.id ? data : item));
      toast.success(paid ? 'Pago marcado como recibido' : 'Pago marcado como pendiente');
    } catch (error) {
      setRepairs((current) => current.map((item) => item.id === repair.id ? { ...item, paid: previousPaid } : item));
      toast.error(error.response?.data?.detail || 'No se pudo cambiar el estado del pago');
    } finally {
      setSavingPaymentId(null);
    }
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
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Reparaciones</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 uppercase tracking-wider">
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

      {customerFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100" data-testid="customer-repairs-banner">
          <span>Historial de reparaciones de <strong>{customerName}</strong></span>
          <Button variant="outline" size="sm" onClick={() => navigate('/repairs')}>Ver todas las reparaciones</Button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
          size="sm"
          data-testid="filter-all"
          aria-pressed={statusFilter === 'all'}
        >
          Todas ({repairs.length})
        </Button>
        <Button
          variant={statusFilter === 'unpaid' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('unpaid')}
          size="sm"
          data-testid="filter-unpaid"
          aria-pressed={statusFilter === 'unpaid'}
        >
          <CircleDollarSign size={16} className="mr-2" />
          Entregadas sin pagar ({unpaidCount})
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
              aria-pressed={statusFilter === status}
            >
              {config.label} ({count})
            </Button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-800">
              <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Ticket</TableHead>
              <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Cliente</TableHead>
              <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Equipo</TableHead>
              <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">IMEI</TableHead>
              <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Estado</TableHead>
              <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100">Fechas</TableHead>
              <TableHead className="font-semibold text-zinc-900 dark:text-zinc-100 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                  {normalizedSearch ? 'No se encontraron resultados' : statusFilter === 'unpaid' ? 'No hay órdenes entregadas pendientes de pago' : customerFilter ? 'Este cliente aún no tiene reparaciones registradas' : 'No hay reparaciones registradas'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRepairs.map((repair) => (
                <TableRow 
                  key={repair.id} 
                  className="cursor-pointer text-zinc-900 transition-colors hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
                  onClick={() => navigate(`/repairs/${repair.id}`)}
                  data-testid={`repair-row-${repair.ticket_number}`}
                >
                  <TableCell className="font-medium">{repair.ticket_number}</TableCell>
                  <TableCell>{repair.customer_name}</TableCell>
                  <TableCell>{repair.device_brand} {repair.device_model}</TableCell>
                  <TableCell className="font-mono text-xs">{repair.device_imei}</TableCell>
                  {/* The portalled status menu also bubbles clicks through this cell. */}
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Select
                        value={repair.status}
                        onValueChange={(status) => handleStatusChange(repair, status)}
                        disabled={savingStatusId === repair.id || TERMINAL_STATUSES.has(repair.status)}
                      >
                        <SelectTrigger
                          className={`h-8 w-[150px] border font-medium ${STATUS_CONFIG[repair.status]?.color}`}
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                          data-testid={`quick-status-${repair.ticket_number}`}
                          aria-label={`Cambiar estado de ${repair.ticket_number}`}
                          title={TERMINAL_STATUSES.has(repair.status) ? 'Estado final: no se puede modificar' : 'Cambiar estado'}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                            <React.Fragment key={value}>
                              <SelectItem
                                value={value}
                                className={value === 'not_repaired' ? 'text-red-700 dark:text-red-400 focus:bg-red-50 focus:text-red-800 dark:focus:bg-red-950 dark:focus:text-red-300' : undefined}
                              >{config.label}</SelectItem>
                              {value === 'not_repaired' && <SelectSeparator />}
                            </React.Fragment>
                          ))}
                        </SelectContent>
                      </Select>
                      {repair.status === 'delivered' && (
                        <div
                          className="flex items-center gap-2"
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <Switch
                            checked={Boolean(repair.paid)}
                            onCheckedChange={(paid) => handlePaymentChange(repair, paid)}
                            disabled={savingPaymentId === repair.id}
                            aria-label={`Marcar pago de ${repair.ticket_number}`}
                            data-testid={`quick-payment-${repair.ticket_number}`}
                          />
                          <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${repair.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {repair.paid ? 'Pagado' : 'Pendiente'}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                    <div className="space-y-1">
                      <p><span className="font-medium text-zinc-700 dark:text-zinc-200">Ingreso:</span> {formatDate(repair.received_date)}</p>
                      {repair.paid_at && (
                        <p className="text-emerald-700 dark:text-emerald-400">
                          <span className="font-medium">Pagado:</span> {formatDateTime(repair.paid_at)}
                        </p>
                      )}
                    </div>
                  </TableCell>
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

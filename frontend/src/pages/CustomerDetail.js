import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ChevronRight, History, Smartphone, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { formatRUT } from '@/utils/rut';

const API = process.env.REACT_APP_BACKEND_URL;
const STATUS_LABELS = {
  received: 'Recibido', diagnosis: 'Diagnóstico', in_repair: 'En reparación',
  completed: 'Completado', delivered: 'Entregado', not_repaired: 'Sin reparación',
};

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Sin fecha';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const headers = getAuthHeader();
    Promise.all([
      axios.get(`${API}/api/customers/${encodeURIComponent(id)}`, { headers }),
      axios.get(`${API}/api/repairs`, { headers, params: { customer_id: id } }),
    ]).then(([customerResponse, repairResponse]) => {
      if (!active) return;
      setCustomer(customerResponse.data);
      setRepairs(repairResponse.data);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.status === 404 ? 'Cliente no encontrado' : 'No se pudo cargar el historial del cliente.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="flex justify-center py-12" aria-label="Cargando cliente"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /></div>;

  if (error) return <div className="space-y-4"><Button variant="ghost" onClick={() => navigate('/customers')}><ArrowLeft size={16} className="mr-2" />Clientes</Button><p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">{error}</p></div>;

  return (
    <div className="max-w-5xl space-y-6" data-testid="customer-detail-page">
      <Button variant="ghost" onClick={() => navigate('/customers')}><ArrowLeft size={16} className="mr-2" />Volver a Clientes</Button>
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-zinc-900 dark:text-zinc-100"><User size={28} />{customer.name}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Ficha del cliente e historial de equipos</p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900" aria-label="Datos del cliente">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Datos del cliente</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ['RUT', customer.rut ? formatRUT(customer.rut) : 'No registrado'],
            ['Teléfono', customer.phone || 'No registrado'],
            ['Correo', customer.email || 'No registrado'],
            ['Dirección', customer.address || 'No registrada'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0"><dt className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">{label}</dt><dd className="mt-1 break-words text-zinc-900 dark:text-zinc-100">{value}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-label="Historial de equipos" data-testid="customer-repair-history">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100"><History size={21} />Historial de equipos</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500 dark:text-zinc-400">{repairs.length} {repairs.length === 1 ? 'orden registrada' : 'órdenes registradas'}</p>
        {repairs.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">Este cliente aún no tiene equipos registrados en reparaciones.</p>
        ) : (
          <div className="space-y-3">
            {repairs.map((repair) => (
              <button key={repair.id} type="button" onClick={() => navigate(`/repairs/${encodeURIComponent(repair.id)}`)}
                className="flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-600 dark:hover:bg-zinc-800"
                aria-label={`Abrir orden ${repair.ticket_number} de ${repair.device_brand} ${repair.device_model}`}
                data-testid={`customer-repair-${repair.id}`}>
                <Smartphone size={21} className="shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{repair.device_brand} {repair.device_model}</span>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-300">{repair.ticket_number} · {formatDate(repair.received_date)} · {STATUS_LABELS[repair.status] || repair.status}</span>
                  {(repair.device_imei || repair.device_serial) && <span className="block break-all text-xs text-zinc-500 dark:text-zinc-400">{repair.device_imei && `IMEI: ${repair.device_imei}`}{repair.device_imei && repair.device_serial && ' · '}{repair.device_serial && `Serie: ${repair.device_serial}`}</span>}
                  {repair.reported_issue && <span className="block text-sm text-zinc-600 dark:text-zinc-300">Falla: {repair.reported_issue}</span>}
                </span>
                <ChevronRight size={18} className="shrink-0 text-zinc-400" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CustomerDetail;

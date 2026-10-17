import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ChevronRight, History, Pencil, Smartphone, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cleanRUT, formatRUT, validateRUT } from '@/utils/rut';

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
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', rut: '', phone: '', email: '', address: '' });

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

  const openEdit = () => {
    setFormData({
      name: customer.name || '',
      rut: customer.rut ? formatRUT(customer.rut) : '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
    });
    setEditOpen(true);
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Ingresa el nombre y el teléfono del cliente.');
      return;
    }
    if (formData.rut && !validateRUT(formData.rut)) {
      toast.error('RUT inválido. Verifica el dígito verificador.');
      return;
    }
    setSaving(true);
    try {
      const response = await axios.put(`${API}/api/customers/${encodeURIComponent(id)}`, {
        ...formData,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        rut: cleanRUT(formData.rut) || null,
      }, { headers: getAuthHeader() });
      setCustomer(response.data);
      setEditOpen(false);
      toast.success('Cliente actualizado');
    } catch (requestError) {
      toast.error(requestError.response?.data?.detail || 'No se pudo actualizar el cliente.');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Datos del cliente</h2>
          <Button type="button" variant="outline" onClick={openEdit} data-testid="edit-customer-button"><Pencil size={16} className="mr-2" />Editar cliente</Button>
        </div>
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

      <Dialog open={editOpen} onOpenChange={(open) => { if (!saving) setEditOpen(open); }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle><DialogDescription>Actualiza los datos de contacto de este cliente.</DialogDescription></DialogHeader>
          <form onSubmit={saveCustomer} className="space-y-4">
            <div className="space-y-1"><Label htmlFor="edit-customer-name">Nombre *</Label><Input id="edit-customer-name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required data-testid="edit-customer-name" /></div>
            <div className="space-y-1"><Label htmlFor="edit-customer-rut">RUT</Label><Input id="edit-customer-rut" value={formData.rut} onChange={(event) => setFormData({ ...formData, rut: formatRUT(event.target.value) })} maxLength={12} placeholder="12.345.678-9" data-testid="edit-customer-rut" /></div>
            <div className="space-y-1"><Label htmlFor="edit-customer-phone">Teléfono *</Label><Input id="edit-customer-phone" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} required data-testid="edit-customer-phone" /></div>
            <div className="space-y-1"><Label htmlFor="edit-customer-email">Correo</Label><Input id="edit-customer-email" type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} data-testid="edit-customer-email" /></div>
            <div className="space-y-1"><Label htmlFor="edit-customer-address">Dirección</Label><Input id="edit-customer-address" value={formData.address} onChange={(event) => setFormData({ ...formData, address: event.target.value })} data-testid="edit-customer-address" /></div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white hover:bg-blue-700" data-testid="save-customer-button">{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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

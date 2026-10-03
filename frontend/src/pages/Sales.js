import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Search, ShoppingBag, Package, UserPlus, Eye, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import DevicePhotos from '@/components/DevicePhotos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { formatCLP } from '@/utils/currency';
import { cleanRUT, formatRUT, validateRUT } from '@/utils/rut';

const API = process.env.REACT_APP_BACKEND_URL;
const CATEGORIES = {
  phone: 'Celular', macbook: 'MacBook', board: 'Placa', spare_part: 'Repuesto', other: 'Otro',
};
const CONDITIONS = {
  new: 'Nuevo', used: 'Usado', refurbished: 'Reacondicionado', for_parts: 'Para repuestos',
};
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const emptySale = () => ({
  customer_id: '', source: 'manual', inventory_item_id: '', item_name: '',
  category: 'phone', quantity: '1', unit_price: '', condition: 'used',
  condition_notes: '', imei: '', serial_number: '', photos: [], notes: '', sold_on: today(),
});
const selectClass = 'mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900';
const SaleField = ({ label, children, mono = false }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
    <dd className={`mt-1 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100 ${mono ? 'font-mono' : ''}`}>
      {children || '—'}
    </dd>
  </div>
);

const Sales = () => {
  const { getAuthHeader } = useAuth();
  const [params, setParams] = useSearchParams();
  const customerFilter = params.get('customer_id') || '';
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [repairCounts, setRepairCounts] = useState({});
  const [saleCounts, setSaleCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [form, setForm] = useState(emptySale);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const customerPickerRef = useRef(null);
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', rut: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const loadCatalogs = async () => {
    const headers = getAuthHeader();
    const [customerResponse, inventoryResponse, repairResponse] = await Promise.all([
      axios.get(`${API}/api/customers`, { headers }),
      axios.get(`${API}/api/inventory`, { headers }),
      axios.get(`${API}/api/repairs`, { headers }).catch(() => ({ data: [] })),
    ]);
    setCustomers(customerResponse.data);
    setInventory(inventoryResponse.data);
    setRepairCounts(repairResponse.data.reduce((counts, repair) => {
      counts[repair.customer_id] = (counts[repair.customer_id] || 0) + 1;
      return counts;
    }, {}));
  };

  const loadSales = async (search = query, customerId = customerFilter) => {
    const { data } = await axios.get(`${API}/api/sales`, {
      headers: getAuthHeader(), params: { q: search.trim(), ...(customerId ? { customer_id: customerId } : {}) },
    });
    setSales(data);
    if (!search.trim() && !customerId) {
      setSaleCounts(data.reduce((counts, sale) => {
        counts[sale.customer_id] = (counts[sale.customer_id] || 0) + 1;
        return counts;
      }, {}));
    }
  };

  useEffect(() => {
    let live = true;
    Promise.all([loadCatalogs(), loadSales('', customerFilter)])
      .catch((error) => { if (live) toast.error(error.response?.data?.detail || 'No se pudieron cargar las ventas'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    let live = true;
    const timer = setTimeout(() => {
      loadSales(query, customerFilter).catch((error) => {
        if (live) toast.error(error.response?.data?.detail || 'No se pudo buscar en ventas');
      });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, customerFilter, loading]);

  useEffect(() => {
    if (!customerPickerOpen) return undefined;
    const closeOutside = (event) => {
      if (!customerPickerRef.current?.contains(event.target)) setCustomerPickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [customerPickerOpen]);

  const openCreate = () => {
    setForm({ ...emptySale(), customer_id: customerFilter });
    setCustomerQuery('');
    setCustomerPickerOpen(false);
    setInventoryQuery('');
    setShowNewCustomer(false);
    setCreateOpen(true);
  };

  const switchSource = (source) => {
    setForm((current) => ({ ...current, source, inventory_item_id: '', item_name: '', unit_price: '', photos: [] }));
    setInventoryQuery('');
  };

  const chooseInventory = (item) => {
    setForm((current) => ({
      ...current, inventory_item_id: item.id, item_name: item.name,
      unit_price: String(Math.round(item.price || 0)), photos: (item.photos || []).slice(0, 5),
    }));
    setInventoryQuery(item.name);
  };

  const createCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error('Escribe el nombre y teléfono del cliente');
      return;
    }
    if (newCustomer.rut.trim() && !validateRUT(newCustomer.rut)) {
      toast.error('El RUT del cliente no es válido');
      return;
    }
    setSavingCustomer(true);
    try {
      const { data } = await axios.post(`${API}/api/customers`, {
        name: newCustomer.name.trim(), phone: newCustomer.phone.trim(),
        rut: newCustomer.rut.trim() ? cleanRUT(newCustomer.rut) : null,
      }, { headers: getAuthHeader() });
      setCustomers((current) => [...current, data]);
      setForm((current) => ({ ...current, customer_id: data.id }));
      setCustomerQuery('');
      setCustomerPickerOpen(false);
      setNewCustomer({ name: '', phone: '', rut: '' });
      setShowNewCustomer(false);
      toast.success('Cliente creado y seleccionado');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo crear el cliente');
    } finally {
      setSavingCustomer(false);
    }
  };

  const submitSale = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (photoBusy) { toast.error('Espera a que terminen de subir las fotos'); return; }
    if (!form.customer_id) { toast.error('Selecciona un cliente'); return; }
    if (form.source === 'inventory' && !form.inventory_item_id) { toast.error('Selecciona un artículo del inventario'); return; }
    if (form.source === 'manual' && !form.item_name.trim()) { toast.error('Escribe el nombre del artículo'); return; }
    if (Number(form.quantity) > 1 && (form.imei.trim() || form.serial_number.trim())) {
      toast.error('Registra por separado cada artículo con IMEI o serie'); return;
    }
    submittingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        ...form, inventory_item_id: form.source === 'inventory' ? form.inventory_item_id : null,
        item_name: form.source === 'manual' ? form.item_name.trim() : null,
        quantity: Number(form.quantity), unit_price: Number(form.unit_price),
      };
      const { data } = await axios.post(`${API}/api/sales`, payload, { headers: getAuthHeader() });
      setSales((current) => customerFilter && data.customer_id !== customerFilter ? current : [data, ...current]);
      setSaleCounts((current) => ({ ...current, [data.customer_id]: (current[data.customer_id] || 0) + 1 }));
      setCreateOpen(false);
      setSelectedSale(data);
      toast.success('Venta registrada con trazabilidad');
      loadCatalogs().catch(() => toast.error('Actualiza la página para ver el stock más reciente'));
      loadSales(query, customerFilter).catch(() => {});
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo registrar la venta');
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const customerActivity = (customer) => (repairCounts[customer.id] || 0) + (saleCounts[customer.id] || 0);
  const normalizedCustomerQuery = customerQuery.trim().toLocaleLowerCase('es');
  const matchingCustomers = customers.filter((customer) => {
    if (!normalizedCustomerQuery) return customerActivity(customer) > 0;
    return `${customer.name} ${customer.rut || ''} ${customer.phone || ''} ${customer.email || ''}`
      .toLocaleLowerCase('es').includes(normalizedCustomerQuery);
  }).sort((first, second) => customerActivity(second) - customerActivity(first) || first.name.localeCompare(second.name, 'es')).slice(0, 8);
  const matchingInventory = inventory.filter((item) =>
    item.available !== false && item.quantity > 0 &&
    `${item.name} ${item.code || ''}`.toLowerCase().includes(inventoryQuery.toLowerCase())
  ).slice(0, 8);
  const chosenCustomer = customers.find((customer) => customer.id === form.customer_id);
  const chosenItem = inventory.find((item) => item.id === form.inventory_item_id);
  const filteredCustomerName = customers.find((customer) => customer.id === customerFilter)?.name;
  const chooseCustomer = (customer) => {
    setForm((current) => ({ ...current, customer_id: customer.id }));
    setCustomerQuery('');
    setCustomerPickerOpen(false);
  };

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Ventas</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Historial de artículos vendidos y de sus compradores</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 text-white hover:bg-blue-700" data-testid="new-sale-button">
          <Plus size={18} className="mr-2" /> Registrar venta
        </Button>
      </div>

      {customerFilter && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <span>Ventas de {filteredCustomerName || 'este cliente'}</span>
          <Button variant="outline" size="sm" onClick={() => setParams({})}>Ver todas</Button>
        </div>
      )}

      <div className="relative max-w-xl">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input className="pl-10" placeholder="Buscar venta, artículo, cliente, RUT, IMEI o serie" value={query}
          onChange={(event) => setQuery(event.target.value)} data-testid="sales-search" />
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <tr>
              <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Artículo</th>
              <th className="px-4 py-3">Cliente</th><th className="px-4 py-3">IMEI / serie</th>
              <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">Cargando ventas...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">Aún no hay ventas para esta búsqueda</td></tr>
            ) : sales.map((sale) => (
              <tr key={sale.id} className="cursor-pointer border-t border-zinc-200 text-zinc-900 transition-colors hover:bg-blue-50/70 focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                onClick={() => setSelectedSale(sale)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedSale(sale); } }}
                tabIndex={0} aria-label={`Ver venta ${sale.sale_number} de ${sale.customer_name}`} data-testid={`sale-${sale.id}`}>
                <td className="px-4 py-3 whitespace-nowrap">{sale.sold_on}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium"><ShoppingBag size={16} className="text-blue-500" />{sale.item_name}</div>
                  <span className="text-xs text-zinc-500">{sale.sale_number} · {CATEGORIES[sale.category]} · {sale.source === 'inventory' ? 'Inventario' : 'Ingreso manual'} · {sale.quantity} ud.</span>
                </td>
                <td className="px-4 py-3">{sale.customer_name}<div className="text-xs text-zinc-500">{sale.customer_rut ? formatRUT(sale.customer_rut) : ''}</div></td>
                <td className="px-4 py-3 font-mono text-xs">
                  {sale.imei && <div>IMEI: {sale.imei}</div>}
                  {sale.serial_number && <div>Serie: {sale.serial_number}</div>}
                  {!sale.imei && !sale.serial_number && '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatCLP(sale.total_price)}</td>
                <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedSale(sale); }}><Eye size={15} className="mr-1" /> Ver</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!saving && !photoBusy) setCreateOpen(open); }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar artículo vendido</DialogTitle>
            <DialogDescription>Guarda el comprador, la identificación y el estado del artículo para consultarlos después.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSale} className="space-y-5" data-testid="sale-form">
            <section className="space-y-2">
              <div className="flex items-center justify-between"><Label>Cliente *</Label><Button type="button" variant="outline" size="sm" onClick={() => setShowNewCustomer(!showNewCustomer)}><UserPlus size={15} className="mr-1" /> Nuevo cliente</Button></div>
              <div ref={customerPickerRef}>
                <Button type="button" variant="outline" role="combobox" aria-expanded={customerPickerOpen}
                  aria-controls="sale-customer-options" onClick={() => setCustomerPickerOpen((open) => !open)}
                  className="w-full justify-between border-zinc-200 font-normal" data-testid="sale-customer-select">
                  <span className="truncate">{chosenCustomer
                    ? `${chosenCustomer.name} — ${chosenCustomer.rut ? formatRUT(chosenCustomer.rut) : chosenCustomer.phone}`
                    : 'Seleccionar cliente'}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                {customerPickerOpen && <div id="sale-customer-options" className="mt-1 rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900">
                  <Command shouldFilter={false} onKeyDown={(event) => { if (event.key === 'Escape') setCustomerPickerOpen(false); }}>
                    <CommandInput placeholder="Buscar cliente por nombre, teléfono, correo o RUT..."
                      value={customerQuery} onValueChange={setCustomerQuery} data-testid="sale-customer-search" autoFocus />
                    <CommandList>
                      <CommandEmpty>{normalizedCustomerQuery ? 'No se encontraron clientes' : 'Escribe para buscar entre todos los clientes'}</CommandEmpty>
                      {matchingCustomers.length > 0 && <CommandGroup heading={normalizedCustomerQuery ? 'Resultados' : 'Clientes frecuentes'}>
                        {matchingCustomers.map((customer) => (
                          <CommandItem key={customer.id} value={customer.id} onSelect={() => chooseCustomer(customer)}>
                            <Check className={`mr-1 h-4 w-4 ${form.customer_id === customer.id ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="min-w-0 flex-1 truncate">{customer.name} — {customer.rut ? formatRUT(customer.rut) : customer.phone}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>}
                    </CommandList>
                  </Command>
                </div>}
              </div>
              {showNewCustomer && <div className="grid gap-2 rounded-md border border-zinc-200 p-3 sm:grid-cols-3">
                <Input placeholder="Nombre *" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                <Input placeholder="Teléfono *" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                <Input placeholder="RUT (opcional)" value={newCustomer.rut} onChange={(e) => setNewCustomer({ ...newCustomer, rut: e.target.value })} />
                <Button type="button" variant="outline" disabled={savingCustomer} onClick={createCustomer} className="sm:col-span-3">{savingCustomer ? 'Guardando...' : 'Crear y seleccionar cliente'}</Button>
              </div>}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="sale-source">Origen *</Label><select id="sale-source" className={selectClass} value={form.source} onChange={(e) => switchSource(e.target.value)}><option value="manual">Ingresar directamente</option><option value="inventory">Tomar del inventario</option></select></div>
              <div><Label htmlFor="sale-category">Tipo de artículo *</Label><select id="sale-category" className={selectClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
            {form.source === 'inventory' ? <section className="space-y-2">
              <Label>Artículo del inventario *</Label>
              {chosenItem && <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">Seleccionado: {chosenItem.name} · Stock: {chosenItem.quantity}</p>}
              <Input placeholder="Buscar en inventario" value={inventoryQuery} onChange={(e) => setInventoryQuery(e.target.value)} />
              <div className="max-h-36 overflow-y-auto rounded-md border border-zinc-200">
                {matchingInventory.map((item) => <button key={item.id} type="button" onClick={() => chooseInventory(item)}
                  className={`flex w-full justify-between border-b border-zinc-100 px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-zinc-800 ${form.inventory_item_id === item.id ? 'font-semibold text-blue-600 dark:text-blue-400' : ''}`}>
                  <span><Package size={15} className="mr-2 inline" />{item.name} · Stock {item.quantity}</span><span>{formatCLP(item.price)}</span>
                </button>)}
                {matchingInventory.length === 0 && <p className="px-3 py-2 text-sm text-zinc-500">No hay artículos con stock disponible</p>}
              </div>
            </section> : <div><Label htmlFor="sale-name">Nombre del artículo *</Label><Input id="sale-name" required maxLength={180} value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="Ej.: iPhone 13 Pro, placa MacBook, batería" /></div>}

            <div className="grid gap-4 sm:grid-cols-3">
              <div><Label htmlFor="sale-quantity">Cantidad *</Label><Input id="sale-quantity" type="number" min="1" max="100" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div><Label htmlFor="sale-price">Precio unitario (CLP) *</Label><Input id="sale-price" type="number" min="0" step="1" required value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
              <div><Label htmlFor="sale-date">Fecha de venta *</Label><Input id="sale-date" type="date" max={today()} required value={form.sold_on} onChange={(e) => setForm({ ...form, sold_on: e.target.value })} /></div>
            </div>
            <p className="text-right text-sm font-semibold text-zinc-900">Total: {formatCLP(Number(form.quantity || 0) * Number(form.unit_price || 0))}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="sale-condition">Estado del artículo *</Label><select id="sale-condition" className={selectClass} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>{Object.entries(CONDITIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div><Label htmlFor="sale-condition-notes">Detalle del estado</Label><Input id="sale-condition-notes" maxLength={500} value={form.condition_notes} onChange={(e) => setForm({ ...form, condition_notes: e.target.value })} placeholder="Ej.: pantalla con marcas leves" /></div>
              <div><Label htmlFor="sale-imei">IMEI (opcional)</Label><Input id="sale-imei" maxLength={80} value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} /></div>
              <div><Label htmlFor="sale-serial">Número de serie (opcional)</Label><Input id="sale-serial" maxLength={80} value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
            </div>
            <p className="text-xs text-zinc-500">Si tiene IMEI o número de serie, registra una unidad por venta para mantener la trazabilidad.</p>
            <div><Label>Fotos del artículo (hasta 5)</Label><div className="mt-2"><DevicePhotos photos={form.photos} onChange={(photos) => setForm((current) => ({ ...current, photos }))}
              authHeader={getAuthHeader()} folder="sales" onBusyChange={setPhotoBusy} onPhotoClick={setSelectedPhoto} subjectLabel="artículo"
              emptyHint="Documenta el estado del artículo al momento de la venta" /></div></div>
            <div><Label htmlFor="sale-notes">Notas de la venta</Label><Textarea id="sale-notes" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Accesorios incluidos u otros detalles" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving || photoBusy}>Cancelar</Button><Button type="submit" disabled={saving || savingCustomer || photoBusy} className="bg-blue-600 text-white hover:bg-blue-700" data-testid="save-sale-button">{saving ? 'Guardando...' : 'Guardar venta'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedSale)} onOpenChange={(open) => { if (!open) setSelectedSale(null); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto p-4 sm:p-6">
          {selectedSale && <>
            <DialogHeader><DialogTitle className="pr-8 text-xl sm:text-2xl">{selectedSale.item_name}</DialogTitle>
              <DialogDescription>{selectedSale.sale_number} · Venta del {selectedSale.sold_on}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="mb-4 text-base font-semibold">Comprador</h3>
                  <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    <SaleField label="Cliente">{selectedSale.customer_name}</SaleField>
                    <SaleField label="RUT">{selectedSale.customer_rut ? formatRUT(selectedSale.customer_rut) : '—'}</SaleField>
                    <SaleField label="Teléfono">{selectedSale.customer_phone}</SaleField>
                  </dl>
                </section>
                <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="mb-4 text-base font-semibold">Artículo</h3>
                  <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    <SaleField label="Tipo">{CATEGORIES[selectedSale.category]}</SaleField>
                    <SaleField label="Origen">{selectedSale.source === 'inventory' ? `Inventario (${selectedSale.inventory_code || 'sin código'})` : 'Ingreso manual'}</SaleField>
                    <SaleField label="Estado">{CONDITIONS[selectedSale.condition]}</SaleField>
                    <SaleField label="Cantidad">{selectedSale.quantity}</SaleField>
                    <SaleField label="IMEI" mono>{selectedSale.imei}</SaleField>
                    <SaleField label="Número de serie" mono>{selectedSale.serial_number}</SaleField>
                    {selectedSale.condition_notes && <div className="sm:col-span-2"><SaleField label="Detalle del estado">{selectedSale.condition_notes}</SaleField></div>}
                  </dl>
                </section>
              </div>
              <div className="space-y-4">
                <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
                  <h3 className="mb-4 text-base font-semibold">Venta</h3>
                  <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    <SaleField label="Precio unitario">{formatCLP(selectedSale.unit_price)}</SaleField>
                    <SaleField label="Total"><span className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCLP(selectedSale.total_price)}</span></SaleField>
                    <SaleField label="Fecha de venta">{selectedSale.sold_on}</SaleField>
                    <SaleField label="Registrada el">{selectedSale.created_at ? new Date(selectedSale.created_at).toLocaleString('es-CL') : '—'}</SaleField>
                    <SaleField label="Registrada por">{selectedSale.sold_by_name}</SaleField>
                  </dl>
                </section>
                <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="mb-3 text-base font-semibold">Fotos del artículo</h3>
                  {selectedSale.photos?.length ? <div className="grid grid-cols-3 gap-2">{selectedSale.photos.map((photo, index) => <button key={`${photo}-${index}`} type="button" onClick={() => setSelectedPhoto(photo)} aria-label={`Ampliar foto ${index + 1} de ${selectedSale.item_name}`} className="overflow-hidden rounded-md border border-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700"><img src={photo} alt={`Foto ${index + 1} de ${selectedSale.item_name}`} className="h-24 w-full object-cover sm:h-28" /></button>)}</div> : <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin fotos</p>}
                </section>
              </div>
            </div>
            {selectedSale.notes && <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><h3 className="mb-2 text-base font-semibold">Notas</h3><p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">{selectedSale.notes}</p></section>}
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedPhoto)} onOpenChange={(open) => { if (!open) setSelectedPhoto(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Foto del artículo</DialogTitle>
            <DialogDescription>Vista ampliada sin salir de Ventas.</DialogDescription>
          </DialogHeader>
          {selectedPhoto && <img src={selectedPhoto} alt="Foto ampliada del artículo" className="max-h-[75vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;

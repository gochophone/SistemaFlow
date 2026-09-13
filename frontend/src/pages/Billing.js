import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/billing`;
const date = value => new Date(value).toLocaleString('es-CL');
const fields = { holder: 'Titular', rut: 'RUT', bank: 'Banco', account_type: 'Tipo de cuenta', account_number: 'Número de cuenta' };
export default function Billing() {
  const { user, token } = useAuth();
  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [bank, setBank] = useState({ holder: '', rut: '', bank: '', account_type: '', account_number: '' });
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const config = { headers: { Authorization: `Bearer ${token}` } };
  const load = async () => {
    const { data } = await axios.get(API, config);
    setStatus(data);
    if (data.bank) setBank(Object.fromEntries(Object.keys(fields).map(key => [key, data.bank[key] || ''])));
    if (data.is_manager) setAccounts((await axios.get(`${API}/admin`, config)).data);
  };
  useEffect(() => { load().catch(() => setError('No se pudo consultar la suscripción. Recarga la página.')); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const action = async task => {
    setBusy(true); setError(''); setMessage('');
    try { const result = await task(); setMessage(result.data.message); await load(); }
    catch (e) { setError(typeof e.response?.data?.detail === 'string' ? e.response.data.detail : 'No se pudo guardar. Revisa los datos e inténtalo nuevamente.'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-4xl space-y-6">
    <h1 className="text-2xl font-bold">Suscripción</h1>
    {error && <p role="alert" className="p-4 bg-red-50 text-red-800 rounded">{error}</p>}
    {message && <p role="status" className="p-4 bg-green-50 text-green-800 rounded">{message}</p>}
    {!status ? <p>Consultando suscripción…</p> : <>
      <section className="bg-white rounded-lg p-6 space-y-3 border">
        <h2 className="text-xl font-semibold">$10.000 CLP / mes por negocio</h2>
        <p>Incluye al propietario, administradores y técnicos. Un mes gratis al crear el negocio.</p>
        <p className={status.active ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>{status.active ? 'Acceso activo' : 'Suscripción vencida'}</p>
        <p>Vencimiento: {date(status.expires_at)}</p>
        {!status.active && <p>Tus datos se conservan. El acceso al sistema se restablece al confirmar el pago.</p>}
        {!user.is_owner && <p>Contacta al propietario de tu negocio para renovar.</p>}
      </section>
      {user.is_owner && <section className="bg-white rounded-lg p-6 border space-y-4">
        <h2 className="font-semibold text-xl">Renovar por transferencia</h2>
        {status.bank ? <><dl className="space-y-2">{Object.entries(fields).map(([key, label]) => <div key={key}><dt className="text-sm text-zinc-500">{label}</dt><dd>{status.bank[key]}</dd></div>)}</dl>
          <p>Transfiere $10.000 CLP. Indica como referencia tu correo de acceso. Cada pago confirmado añade un mes desde el vencimiento o desde la confirmación si ya venció.</p>
          {status.pending ? <p className="bg-amber-50 p-3">Pago pendiente de revisión: {status.pending.reference}. No vuelvas a transferir por esta solicitud.</p> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); action(() => axios.post(`${API}/report`, { reference }, config)); }}>
            <label htmlFor="payment-reference">Referencia o número de operación de la transferencia</label>
            <Input id="payment-reference" required minLength={3} maxLength={200} value={reference} onChange={e => setReference(e.target.value)} />
            <Button disabled={busy}>Ya transferí: solicitar revisión</Button>
            <p className="text-sm text-zinc-600">La solicitud no confirma el pago. El responsable verificará la transferencia en el banco.</p>
          </form>}</> : <p>Los datos de transferencia estarán disponibles cuando el responsable los configure.</p>}
        {status.history.length > 0 && <div><h3 className="font-semibold">Últimas revisiones</h3>{[...status.history].reverse().map(item => <p key={item.id} className="py-2 border-b">{date(item.reviewed_at)} — {item.approved ? 'Confirmado · $10.000 CLP' : 'Rechazado'} — {item.note}</p>)}</div>}
      </section>}
      {status.is_manager && <>
        <section className="bg-white rounded-lg p-6 border space-y-4">
          <h2 className="font-semibold text-xl">Administración de cobros</h2>
          <p>Confirma únicamente transferencias que hayas verificado en tu cuenta bancaria.</p>
          <Button variant="outline" disabled={busy} onClick={() => action(async () => { await load(); return { data: { message: 'Listado actualizado' } }; })}>Actualizar listado</Button>
          {accounts.map(account => <article key={account.tenant_id} className="border rounded p-4 space-y-3">
            <h3 className="font-semibold">{account.company}</h3><p>{account.email}</p>
            <p>{account.active ? 'Activo' : 'Vencido'} · hasta {date(account.expires_at)}</p>
            {account.pending ? <><p>Referencia: {account.pending.reference}</p><p>Informado: {date(account.pending.reported_at)}</p>
              <label className="block">Nota de revisión<Input minLength={3} maxLength={200} value={notes[account.tenant_id] || ''} onChange={e => setNotes({ ...notes, [account.tenant_id]: e.target.value })} /></label>
              <div className="flex gap-3 flex-wrap">{[true, false].map(approve => <Button key={String(approve)} variant={approve ? 'default' : 'outline'} disabled={busy || (notes[account.tenant_id] || '').trim().length < 3} onClick={() => {
                if (window.confirm(approve ? `¿Confirmas haber recibido $10.000 CLP de ${account.email}? Se añadirá un mes de acceso.` : '¿Rechazar esta solicitud sin renovar el acceso?')) action(() => axios.post(`${API}/admin/${account.tenant_id}/${account.pending.id}`, { approve, note: notes[account.tenant_id] }, config));
              }}>{approve ? 'Confirmar pago y renovar' : 'Rechazar'}</Button>)}</div></> : <p className="text-zinc-500">Sin pagos pendientes</p>}
          </article>)}
        </section>
        <form className="bg-white rounded-lg p-6 border space-y-4" onSubmit={e => { e.preventDefault(); action(() => axios.put(`${API}/bank`, bank, config)); }}>
          <h2 className="text-xl font-semibold">Cuenta para recibir transferencias</h2>
          {Object.entries(fields).map(([key, label]) => <label className="block" key={key}>{label}<Input required maxLength={key === 'holder' ? 150 : key === 'rut' ? 30 : key === 'account_number' ? 50 : 100} value={bank[key]} onChange={e => setBank({ ...bank, [key]: e.target.value })} /></label>)}
          <Button disabled={busy}>Guardar datos bancarios</Button>
        </form>
      </>}
    </>}
  </div>;
}

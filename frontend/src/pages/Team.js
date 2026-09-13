import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL;
const emptyForm = { name: '', email: '', password: '', role: 'technician' };

export default function Team() {
  const { user, getAuthHeader } = useAuth();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/api/team`, { headers: getAuthHeader() });
      setMembers(data); setError('');
    } catch { setError('No se pudo cargar el equipo. Intenta de nuevo.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await axios.post(`${API}/api/team`, form, { headers: getAuthHeader() });
      setForm(emptyForm); toast.success('Usuario creado en tu cuenta'); await load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Revisa los datos del usuario');
    } finally { setBusy(false); }
  };
  const update = async (member, changes) => {
    setBusy(true);
    try {
      await axios.patch(`${API}/api/team/${member.id}`, changes, { headers: getAuthHeader() });
      toast.success('Acceso actualizado'); await load();
    } catch (err) { toast.error(err.response?.data?.detail || 'No se pudo actualizar el acceso'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Equipo de trabajo</h1>
      <p className="text-zinc-600 mt-2">Todos los integrantes trabajan con los datos de esta cuenta. Solo los administradores pueden acceder al inventario.</p></div>
    <form onSubmit={create} className="bg-white rounded-lg border p-6 space-y-4">
      <h2 className="text-xl font-semibold">Crear usuario</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label>Nombre<Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>Correo<Input required type="email" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label>Contraseña<Input required type="password" minLength={10} maxLength={72} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><span className="text-xs text-zinc-500">Mínimo 10 caracteres.</span></label>
        <label>Rol<select className="block border rounded-md p-2 w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="technician">Técnico — sin inventario</option><option value="admin">Administrador — con inventario</option>
        </select></label>
      </div><Button disabled={busy} type="submit">{busy ? 'Guardando…' : 'Crear usuario'}</Button>
    </form>
    {error && <div role="alert" className="text-red-700">{error} <button onClick={load} className="underline">Reintentar</button></div>}
    {loading ? <p>Cargando equipo…</p> : <div className="bg-white rounded-lg border overflow-x-auto"><table className="w-full text-left">
      <thead><tr className="border-b"><th className="p-4">Usuario</th><th className="p-4">Rol</th><th className="p-4">Estado</th><th className="p-4">Acceso</th></tr></thead>
      <tbody>{members.map(member => <tr key={member.id} className="border-b last:border-0">
        <td className="p-4"><div className="font-medium">{member.name}{member.is_owner ? ' · Cuenta principal' : ''}</div><div className="text-sm text-zinc-500">{member.email}</div></td>
        <td className="p-4"><select aria-label={`Rol de ${member.name}`} disabled={busy || member.is_owner || member.id === user.id} value={member.role} onChange={e => update(member, { role: e.target.value })} className="border rounded-md p-2">
          <option value="admin">Administrador</option><option value="technician">Técnico</option>{!['admin', 'technician'].includes(member.role) && <option value={member.role}>{member.role}</option>}
        </select></td><td className="p-4">{member.active ? 'Activo' : 'Desactivado'}</td>
        <td className="p-4"><Button variant="outline" disabled={busy || member.is_owner || member.id === user.id} onClick={() => update(member, { active: !member.active })}>{member.active ? 'Desactivar' : 'Activar'}</Button></td>
      </tr>)}</tbody>
    </table></div>}
  </div>;
}

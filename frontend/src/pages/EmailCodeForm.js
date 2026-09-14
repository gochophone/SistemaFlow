import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
const API = process.env.REACT_APP_BACKEND_URL;
export const authError = error => typeof error.response?.data?.detail === 'string'
  ? error.response.data.detail : !error.response ? 'No se pudo conectar con el servidor.' : 'Revisa el correo, el código y la contraseña (mínimo 10 caracteres).';

export default function EmailCodeForm({ registration, onDone, onBack }) {
  const [email, setEmail] = useState(registration?.email || '');
  const [sent, setSent] = useState(Boolean(registration));
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextSend, setNextSend] = useState(registration ? Date.now() + 60000 : 0);
  const send = async () => {
    if (Date.now() < nextSend) { toast.error('Espera un minuto antes de reenviar.'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/api/auth/${registration ? 'register' : 'password/request'}`, registration || { email });
      setSent(true); setCode(''); setNextSend(Date.now() + 60000);
      toast.success('Si el correo corresponde a una cuenta, recibirás un código. Revisa spam.');
    } catch (error) { toast.error(authError(error)); }
    finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (!sent) { await send(); return; }
    if (!registration && password !== confirmation) { toast.error('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/api/auth/${registration ? 'register/verify' : 'password/reset'}`, { email, code, ...(!registration ? { password } : {}) });
      toast.success(registration ? 'Correo verificado. Tu cuenta está creada. Inicia sesión.' : 'Contraseña actualizada. Inicia sesión con la nueva contraseña.');
      onDone(email);
    } catch (error) { toast.error(authError(error)); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="space-y-4">
    <h2 className="text-xl font-semibold">{registration ? 'Verificar correo' : 'Recuperar contraseña'}</h2>
    <p className="text-sm text-zinc-600">{sent ? 'Introduce el código de 6 dígitos enviado a tu correo. Vence en 10 minutos. Revisa también spam.' : 'Escribe el correo de tu cuenta para recibir un código y elegir una contraseña nueva.'}</p>
    <div><Label htmlFor="code-email">Correo electrónico</Label><Input id="code-email" type="email" required autoComplete="email" readOnly={sent} value={email} onChange={e => setEmail(e.target.value)} /></div>
    {sent && <div><Label htmlFor="email-code">Código de verificación</Label><Input id="email-code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></div>}
    {sent && !registration && <>
      <div><Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /><p className="text-xs text-zinc-500">Mínimo 10 caracteres.</p></div>
      <div><Label htmlFor="confirm-new-password">Repite la nueva contraseña</Label><Input id="confirm-new-password" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
    </>}
    <Button className="w-full" disabled={busy}>{busy ? 'Procesando...' : !sent ? 'Enviar código' : registration ? 'Verificar y crear cuenta' : 'Cambiar contraseña'}</Button>
    {sent && <Button type="button" variant="outline" disabled={busy} onClick={send} className="w-full">Reenviar código</Button>}
    <Button type="button" variant="ghost" disabled={busy} onClick={onBack} className="w-full">Volver</Button>
  </form>;
}

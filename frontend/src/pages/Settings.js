import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Check, FileSpreadsheet, Image as ImageIcon, Moon, Settings as SettingsIcon, Sun, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';

const THEME_KEY = 'ifixflow-theme';
const API = process.env.REACT_APP_BACKEND_URL;

const applyTheme = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent('ifixflow-theme-changed', { detail: theme }));
};

const Settings = () => {
  const { user, token, refreshUser } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [files, setFiles] = useState({ customers: null, repairs: null });
  const [importing, setImporting] = useState('');
  const [importResult, setImportResult] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [rutBusy, setRutBusy] = useState(false);
  const [logoMessage, setLogoMessage] = useState('');
  const [companyRut, setCompanyRut] = useState(user?.company_rut || '');
  const [companyAddress, setCompanyAddress] = useState(user?.company_address || '');
  const logoInput = useRef(null);
  const customerInput = useRef(null);
  const repairInput = useRef(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setCompanyRut(user?.company_rut || '');
    setCompanyAddress(user?.company_address || '');
  }, [user?.company_rut, user?.company_address]);

  const saveCompanyLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoMessage('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setLogoMessage('Usa una imagen PNG, JPG o WebP de hasta 3 MB. Para un mejor resultado, utiliza fondo transparente.');
      event.target.value = '';
      return;
    }
    setLogoBusy(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data: signed } = await axios.get(`${API}/api/cloudinary/signature`, {
        headers,
        params: { resource_type: 'image', folder: 'users' },
      });
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', signed.api_key);
      form.append('timestamp', signed.timestamp);
      form.append('signature', signed.signature);
      form.append('folder', signed.folder);
      const upload = await axios.post(`https://api.cloudinary.com/v1_1/${signed.cloud_name}/image/upload`, form);
      await axios.patch(`${API}/api/settings/company`, { company_logo_url: upload.data.secure_url }, { headers });
      await refreshUser();
      setLogoMessage('Logo guardado. Ya se muestra para todo el equipo.');
    } catch (error) {
      setLogoMessage(error.response?.data?.detail || 'No se pudo guardar el logo. Inténtalo nuevamente.');
    } finally {
      setLogoBusy(false);
      if (logoInput.current) logoInput.current.value = '';
    }
  };

  const removeCompanyLogo = async () => {
    setLogoBusy(true);
    setLogoMessage('');
    try {
      await axios.patch(`${API}/api/settings/company`, { company_logo_url: null }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUser();
      setLogoMessage('Logo eliminado.');
    } catch (error) {
      setLogoMessage(error.response?.data?.detail || 'No se pudo eliminar el logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  const saveCompanyDetails = async () => {
    setRutBusy(true);
    setLogoMessage('');
    try {
      await axios.patch(`${API}/api/settings/company`, { company_rut: companyRut.trim(), company_address: companyAddress.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUser();
      setLogoMessage('RUT y dirección guardados. Se mostrarán en los PDF de entrega.');
    } catch (error) {
      setLogoMessage(error.response?.data?.detail || 'No se pudieron guardar los datos de la empresa.');
    } finally {
      setRutBusy(false);
    }
  };

  const importGestioo = async (type) => {
    const file = files[type];
    if (!file) return;
    setImporting(type);
    setImportResult('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/imports/gestioo/${type}`,
        form,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const summary = type === 'customers'
        ? `${data.created} clientes creados${data.skipped ? ` · ${data.skipped} omitidos por estar repetidos o incompletos` : ''}.`
        : `${data.created_repairs} reparaciones importadas y ${data.created_customers} clientes creados${data.skipped ? ` · ${data.skipped} filas omitidas` : ''}.`;
      setImportResult(summary + (data.errors?.length ? ` Revisa: ${data.errors[0]}` : ''));
      setFiles((current) => ({ ...current, [type]: null }));
      if (type === 'customers' && customerInput.current) customerInput.current.value = '';
      if (type === 'repairs' && repairInput.current) repairInput.current.value = '';
    } catch (error) {
      setImportResult(error.response?.data?.detail || 'No se pudo importar el archivo. Verifica que sea CSV, XLS o XLSX.');
    } finally {
      setImporting('');
    }
  };

  const options = [
    {
      value: 'light',
      title: 'Fondo blanco',
      description: 'Interfaz clara para trabajar durante el día.',
      icon: Sun,
      preview: 'bg-white border-zinc-200',
    },
    {
      value: 'dark',
      title: 'Fondo oscuro',
      description: 'Interfaz oscura para reducir el brillo de la pantalla.',
      icon: Moon,
      preview: 'bg-zinc-900 border-zinc-700',
    },
  ];

  return (
    <div className="max-w-3xl space-y-6" data-testid="settings-page">
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Configuración</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Personaliza la apariencia de iFixFlow.</p>
          </div>
        </div>
      </div>

      {user?.role === 'admin' && (
        <Card className="border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900" data-testid="company-logo-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100"><ImageIcon size={22} className="text-blue-600 dark:text-blue-400" />Logo de la empresa</CardTitle>
            <CardDescription className="dark:text-zinc-400">Aparecerá a la izquierda del nombre del negocio en el sistema, las etiquetas y los PDF de entrega.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700">
                {user.company_logo_url ? <img src={user.company_logo_url} alt="Logo actual de la empresa" className="h-full w-full object-contain" /> : <ImageIcon className="text-zinc-400" size={32} />}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={logoBusy} onClick={() => logoInput.current?.click()}>
                  <Upload size={16} className="mr-2" />{logoBusy ? 'Guardando…' : user.company_logo_url ? 'Cambiar logo' : 'Agregar logo'}
                </Button>
                {user.company_logo_url && <Button type="button" variant="outline" disabled={logoBusy} onClick={removeCompanyLogo}><Trash2 size={16} className="mr-2" />Quitar</Button>}
              </div>
            </div>
            <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={saveCompanyLogo} />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">PNG, JPG o WebP, máximo 3 MB. Se recomienda una imagen cuadrada con fondo transparente.</p>
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <label htmlFor="company-rut" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">RUT de la empresa</label>
              <div className="mt-2 grid gap-3">
                <Input id="company-rut" value={companyRut} onChange={(event) => setCompanyRut(event.target.value)} placeholder="Ejemplo: 77.322.829-9" className="dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                <div>
                  <label htmlFor="company-address" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Dirección de la empresa</label>
                  <Input id="company-address" value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} placeholder="Ejemplo: Av. Principal 123, Santiago" className="mt-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
                <Button type="button" onClick={saveCompanyDetails} disabled={rutBusy || !companyRut.trim()} className="sm:w-fit">{rutBusy ? 'Guardando…' : 'Guardar datos de empresa'}</Button>
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">El nombre, RUT y dirección aparecerán debajo de la firma del técnico.</p>
            </div>
            {logoMessage && <p role="status" className="rounded-md bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-100">{logoMessage}</p>}
          </CardContent>
        </Card>
      )}

      <Card className="border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-900 dark:text-zinc-100">Apariencia</CardTitle>
          <CardDescription className="dark:text-zinc-400">Elige el color de fondo del sistema. El ajuste se guarda en este dispositivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {options.map(({ value, title, description, icon: Icon, preview }) => {
              const selected = theme === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => setTheme(value)}
                  data-testid={`theme-${value}`}
                  className={`relative rounded-lg border p-4 text-left transition-colors ${selected ? 'border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'}`}
                >
                  <div className={`mb-4 h-20 rounded-md border ${preview} p-3`}>
                    <div className={`h-2 w-16 rounded ${value === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                    <div className={`mt-2 h-2 w-10 rounded ${value === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                  </div>
                  <div className="flex items-start gap-3">
                    <Icon size={20} className="mt-0.5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
                    </div>
                  </div>
                  {selected && <Check size={18} className="absolute right-3 top-3 text-blue-600 dark:text-blue-400" aria-label="Seleccionado" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {user?.role === 'admin' && (
        <Card className="border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900" data-testid="gestioo-import">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100"><FileSpreadsheet size={22} className="text-blue-600 dark:text-blue-400" />Importar</CardTitle>
            <CardDescription className="dark:text-zinc-400">Carga las exportaciones CSV, XLS o XLSX. Primero importa clientes y luego las órdenes: cada reparación quedará enlazada a su cliente por nombre, teléfono o correo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {[['customers', '1. Clientes', 'Exportación de clientes de Gestioo', customerInput], ['repairs', '2. Reparaciones', '“Todas las órdenes” descargadas desde Gestioo', repairInput]].map(([type, title, hint, inputRef]) => (
                <div key={type} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{hint}</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    className="mt-3 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-700 hover:file:bg-blue-100 dark:text-zinc-300 dark:file:bg-blue-500/20 dark:file:text-blue-300"
                    onChange={(event) => setFiles((current) => ({ ...current, [type]: event.target.files?.[0] || null }))}
                  />
                  {files[type] && <p className="mt-2 truncate text-sm text-zinc-600 dark:text-zinc-400">Archivo: {files[type].name}</p>}
                  <Button className="mt-3 w-full" disabled={!files[type] || Boolean(importing)} onClick={() => importGestioo(type)}>
                    <Upload size={16} className="mr-2" />{importing === type ? 'Importando…' : `Importar ${type === 'customers' ? 'clientes' : 'reparaciones'}`}
                  </Button>
                </div>
              ))}
            </div>
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              La importación no elimina datos existentes. Los clientes repetidos se omiten y las órdenes reciben un nuevo número iFixFlow, conservando el número original en las notas.
            </div>
            {importResult && <p role="status" className="rounded-md bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-100">{importResult}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Settings;

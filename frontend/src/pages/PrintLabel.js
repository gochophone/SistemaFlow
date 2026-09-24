import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import './PrintLabel.css';

const API = process.env.REACT_APP_BACKEND_URL;
const defaults = { width: 62, height: 29, font: 7, customer: true, device: true, imei: false, issue: true, date: false, qr: true };
const choices = { customer: 'Cliente', device: 'Marca y modelo', imei: 'IMEI', issue: 'Falla reportada', date: 'Fecha de ingreso', qr: 'Código QR de seguimiento' };
function saved(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    if (!data || typeof data !== 'object') return defaults;
    return { ...defaults, ...Object.fromEntries(Object.keys(defaults).filter(k => typeof data[k] === typeof defaults[k]).map(k => [k, data[k]])) };
  } catch { return defaults; }
}
export default function PrintLabel() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const companyName = user.company_name || 'Mi negocio';
  const companyLogo = user.company_logo_url;
  const key = `ifixflow-label-v1:${user.tenant_id}`;
  const [config, setConfig] = useState(() => saved(key));
  const [customSize, setCustomSize] = useState(false);
  const [repair, setRepair] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  const [overflow, setOverflow] = useState(false);
  const content = useRef(null);
  const text = useRef(null);
  const valid = Number.isFinite(Number(config.width)) && config.width >= 30 && config.width <= 150 && config.height >= 20 && config.height <= 150 && config.font >= 5 && config.font <= 14;
  const width = valid ? Number(config.width) : 62;
  const height = valid ? Number(config.height) : 29;
  useEffect(() => {
    let live = true;
    setLoading(true); setError(''); setRepair(null);
    axios.get(`${API}/api/repairs/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (live) setRepair(data); })
      .catch(e => { if (live) setError(e.response?.status === 404 ? 'No se encontró esta reparación.' : 'No se pudo cargar la etiqueta. Comprueba la conexión y vuelve a intentarlo.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, token, attempt]);
  useLayoutEffect(() => {
    const measure = () => setOverflow([content.current, text.current].some(el => el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)));
    measure();
    const observer = new ResizeObserver(measure);
    if (content.current) observer.observe(content.current);
    if (text.current) observer.observe(text.current);
    return () => observer.disconnect();
  }, [config, repair]);
  const change = (name, value) => { setConfig(c => ({ ...c, [name]: value })); setNotice(''); };
  const store = () => { try { localStorage.setItem(key, JSON.stringify(config)); setNotice('Preferencias guardadas para este negocio en este navegador.'); } catch { setNotice('El navegador no permite guardar preferencias. Puedes imprimir igualmente.'); } };
  const publicUrl = repair?.public_token ? `${window.location.origin}/public/${repair.public_token}` : null;
  return <div className="label-editor">
    <div className="label-settings">
      <h1>Configurar etiqueta</h1>
      <Link to={`/repairs/${id}`}>Volver a la reparación</Link>
      <label>Tamaño<select value={!customSize && ['62x29', '50x30', '80x50', '100x50'].includes(`${config.width}x${config.height}`) ? `${config.width}x${config.height}` : 'custom'} onChange={e => { setCustomSize(e.target.value === 'custom'); if (e.target.value !== 'custom') { const [w, h] = e.target.value.split('x').map(Number); setConfig(c => ({ ...c, width: w, height: h })); } }}>
        <option value="62x29">62 × 29 mm</option><option value="50x30">50 × 30 mm</option><option value="80x50">80 × 50 mm</option><option value="100x50">100 × 50 mm</option><option value="custom">Personalizado (edita las medidas)</option>
      </select></label>
      <div className="label-dimensions">
        <label>Ancho (mm)<input type="number" min="30" max="150" value={config.width} onChange={e => change('width', e.target.value === '' ? '' : Number(e.target.value))} /></label>
        <label>Alto (mm)<input type="number" min="20" max="150" value={config.height} onChange={e => change('height', e.target.value === '' ? '' : Number(e.target.value))} /></label>
        <label>Letra (pt)<input type="number" min="5" max="14" step="0.5" value={config.font} onChange={e => change('font', e.target.value === '' ? '' : Number(e.target.value))} /></label>
      </div>
      <label>Nombre del negocio<input value={companyName} readOnly /></label>
      <fieldset><legend>Contenido (el número de ticket siempre se incluye)</legend>{Object.entries(choices).map(([name, label]) => <label className="label-check" key={name}><input type="checkbox" checked={config[name]} onChange={e => change(name, e.target.checked)} />{label}</label>)}</fieldset>
      {!valid && <p role="alert">Usa un ancho de 30 a 150 mm, alto de 20 a 150 mm y letra de 5 a 14 pt.</p>}
      {overflow && <p role="alert">El contenido no cabe: aumenta el tamaño, reduce la letra o desmarca campos antes de imprimir.</p>}
      {config.qr && repair && !publicUrl && <p role="alert">Esta reparación no tiene enlace de seguimiento. Se imprimirá sin QR.</p>}
      <div className="label-actions"><button disabled={!repair || !valid || overflow || loading} onClick={() => window.print()}>Imprimir etiqueta</button><button disabled={!valid} onClick={store}>Guardar preferencias</button><button onClick={() => { setConfig(defaults); setCustomSize(false); setNotice(''); }}>Restablecer</button></div>
      {notice && <p role="status">{notice}</p>}
      <p>En el diálogo de impresión usa el mismo tamaño de papel, escala 100 %, sin márgenes ni encabezados. El tamaño debe estar admitido por tu impresora.</p>
    </div>
    <div className="label-preview-area">
      {loading ? <p>Cargando reparación…</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setAttempt(a => a + 1)}>Reintentar</button></div> : repair && <>
        <p className="label-preview-caption">Vista previa · {width} × {height} mm</p>
        <style>{`@media print { @page { size: ${width}mm ${height}mm; margin: 0; } html, body, #root { width: ${width}mm !important; margin: 0 !important; padding: 0 !important; } }`}</style>
        <div className="repair-print-label" style={{ width: `${width}mm`, height: `${height}mm`, fontSize: `${valid ? config.font : 7}pt` }}>
          <div className="repair-label-content" ref={content}>
            <div className="repair-label-text" ref={text}>
              <div className="repair-label-brand">{companyLogo && <img src={companyLogo} alt="" />}<strong>{companyName}</strong></div>
              <strong>Ticket: {repair.ticket_number || '—'}</strong>
              {config.customer && <div>{repair.customer_name || 'Sin cliente'}</div>}
              {config.device && <div>{[repair.device_brand, repair.device_model].filter(Boolean).join(' ') || 'Sin modelo'}</div>}
              {config.imei && <div>IMEI: {repair.device_imei || '—'}</div>}
              {config.issue && <div>Falla: {repair.reported_issue || 'No indicada'}</div>}
              {config.date && <div>Ingreso: {repair.created_at ? new Date(repair.created_at).toLocaleDateString('es-CL') : '—'}</div>}
            </div>
            {config.qr && publicUrl && <div className="repair-label-qr" style={{ width: `${Math.min(22, height - 4, width * 0.35)}mm` }}><QRCodeSVG value={publicUrl} size={100} level="M" includeMargin /><span>Seguimiento</span></div>}
          </div>
        </div>
      </>}
    </div>
  </div>;
}

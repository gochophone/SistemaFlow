import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, Printer } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/utils/currency';
import './Reports.css';

const API = process.env.REACT_APP_BACKEND_URL;

const chileToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const initialFilters = () => {
  const today = chileToday();
  const [year, month] = today.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${today.slice(0, 7)}-01`, end: `${today.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`, technician_id: '' };
};

const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const shortDate = (value) => value.split('-').reverse().join('/');
const reportPeriod = (report) => `${shortDate(report.start)} al ${shortDate(report.end)}`;

const downloadCsv = (report) => {
  const lines = [
    ['Reporte de reparaciones', reportPeriod(report)],
    [],
    ['TRABAJOS TERMINADOS', reportPeriod(report)],
    [],
    ['Fecha de término', 'Orden', 'Cliente', 'Equipo', 'Trabajo', 'Técnico', 'Estado', 'Precio final', 'Costo registrado'],
    ...report.rows.map((row) => [row.finished_date, row.ticket_number, row.customer_name,
      row.device, row.work, row.technician, row.status, row.value, row.cost]),
    ['VALOR TOTAL DE TRABAJOS', '', '', '', '', '', '', report.summary.final_value, ''],
    ['COSTOS REGISTRADOS', '', '', '', '', '', '', '', report.summary.recorded_cost],
    [],
    ['PAGOS REGISTRADOS', reportPeriod(report)],
    [],
    ['Fecha de pago', 'Orden', 'Cliente', 'Equipo', 'Técnico', 'Fecha de término', 'Monto cobrado'],
    ...(report.payment_rows || []).map((row) => [row.paid_date, row.ticket_number, row.customer_name,
      row.device, row.technician, row.finished_date || '', row.value]),
    ['TOTAL COBRADO', '', '', '', '', '', report.summary.collected],
  ];
  const blob = new Blob([`\uFEFF${lines.map((line) => line.map(csvCell).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte_reparaciones_${report.start}_${report.end}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const ReportCard = ({ label, value, detail }) => (
  <div className="report-card rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
    <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
    {detail && <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{detail}</p>}
  </div>
);

export default function Reports() {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(initialFilters);
  const [technicians, setTechnicians] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    axios.get(`${API}/api/team`, { headers: getAuthHeader() })
      .then(({ data }) => {
        if (live) setTechnicians(data.filter((user) => user.role === 'technician').sort((a, b) => a.name.localeCompare(b.name, 'es')));
      })
      .catch(() => { if (live) setError('No se pudo cargar la lista de técnicos. Puedes generar el reporte de todos.'); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setReport(null);
    setError('');
  };

  const generate = async (event) => {
    event.preventDefault();
    if (!filters.start || !filters.end || filters.end < filters.start) {
      setError('Selecciona un rango de fechas válido.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.get(`${API}/api/reports/repairs`, {
        headers: getAuthHeader(),
        params: { start: filters.start, end: filters.end, ...(filters.technician_id ? { technician_id: filters.technician_id } : {}) },
      });
      setReport(data);
    } catch (failure) {
      setReport(null);
      setError(failure.response?.data?.detail || 'No se pudo generar el reporte. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const selectedTechnician = technicians.find((item) => item.id === filters.technician_id);

  return <div className="report-page space-y-6 text-zinc-900 dark:text-zinc-100" data-testid="reports-page">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold"><BarChart3 className="text-blue-600" />Reportes</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Trabajos por fecha de término, entregas por fecha de entrega y cobros por fecha de pago.</p>
      </div>
    </div>

    <form onSubmit={generate} className="report-filters report-card rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
        <label className="block text-sm font-medium">Desde
          <input type="date" value={filters.start} onChange={(event) => setFilter('start', event.target.value)}
            className="mt-1 block h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" data-testid="report-start" />
        </label>
        <label className="block text-sm font-medium">Hasta
          <input type="date" value={filters.end} onChange={(event) => setFilter('end', event.target.value)}
            className="mt-1 block h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" data-testid="report-end" />
        </label>
        <label className="block text-sm font-medium">Técnico
          <select value={filters.technician_id} onChange={(event) => setFilter('technician_id', event.target.value)}
            className="mt-1 block h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100" data-testid="report-technician">
            <option value="">Todos los técnicos</option>
            {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}{technician.active === false ? ' (inactivo)' : ''}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={busy} data-testid="generate-report">{busy ? 'Generando...' : 'Generar reporte'}</Button>
      </div>
    </form>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

    {!report && !busy && <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">Elige el período y pulsa «Generar reporte».</p>}

    {report && <div className="space-y-6" data-testid="generated-report">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{report.start} al {report.end}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{selectedTechnician ? `Técnico: ${selectedTechnician.name}` : 'Todos los técnicos'} · Horario de Chile</p>
        </div>
        <div className="report-actions flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => downloadCsv(report)}><Download size={16} className="mr-2" />Descargar CSV</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer size={16} className="mr-2" />Imprimir / guardar PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="report-card rounded-xl border border-blue-200 border-l-4 border-l-blue-600 bg-blue-50 p-5 dark:border-blue-900 dark:border-l-blue-400 dark:bg-blue-950/40">
          <h3 className="text-sm font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">Trabajos terminados</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{report.summary.finished} órdenes terminadas del {reportPeriod(report)}</p>
          <p className="mt-5 text-sm font-medium">Valor total de estas órdenes</p>
          <p className="mt-1 text-3xl font-bold">{formatCLP(report.summary.final_value)}</p>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Suma de los precios finales en la tabla de trabajos.</p>
        </section>
        <section className="report-card rounded-xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-5 dark:border-emerald-900 dark:border-l-emerald-400 dark:bg-emerald-950/40">
          <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Pagos registrados</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{report.summary.paid_count} órdenes pagadas del {reportPeriod(report)}</p>
          <p className="mt-5 text-sm font-medium">Total cobrado en esas fechas</p>
          <p className="mt-1 text-3xl font-bold">{formatCLP(report.summary.collected)}</p>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Suma de la tabla de pagos; puede incluir trabajos de meses anteriores.</p>
        </section>
      </div>

      <section className="report-card report-table-card rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-1 text-lg font-semibold">Trabajos terminados ({report.rows.length})</h3>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Órdenes terminadas entre el {reportPeriod(report)}. Su total es la suma de la columna «Precio final».</p>
        {report.rows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay trabajos terminados con estos filtros.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"><th className="py-2 pr-3">Fecha de término</th><th className="py-2 pr-3">Orden</th><th className="py-2 pr-3">Cliente / equipo</th><th className="py-2 pr-3">Trabajo</th><th className="py-2 pr-3">Técnico</th><th className="py-2 pr-3">Estado</th><th className="py-2 text-right">Precio final</th><th className="py-2 text-right">Costo registrado</th></tr></thead>
          <tbody>{report.rows.map((row) => <tr key={row.id || row.ticket_number} className="border-b border-zinc-100 dark:border-zinc-800">
            <td className="py-3 pr-3 whitespace-nowrap">{shortDate(row.finished_date)}</td>
            <td className="py-3 pr-3"><button type="button" onClick={() => navigate(`/repairs/${row.id}`)} className="report-order-link font-medium text-blue-600 hover:underline dark:text-blue-400">{row.ticket_number}</button></td>
            <td className="py-3 pr-3">{row.customer_name}<span className="block text-xs text-zinc-500 dark:text-zinc-400">{row.device}</span></td>
            <td className="py-3 pr-3">{row.work}</td>
            <td className="py-3 pr-3">{row.technician}</td><td className="py-3 pr-3">{row.status}</td>
            <td className="py-3 text-right whitespace-nowrap">{formatCLP(row.value)}</td><td className="py-3 text-right whitespace-nowrap">{row.cost ? formatCLP(row.cost) : '—'}</td>
          </tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-blue-500 bg-blue-50 font-bold dark:bg-blue-950/50">
            <td colSpan={6} className="px-2 py-3">VALOR TOTAL DE TRABAJOS</td>
            <td className="px-2 py-3 text-right whitespace-nowrap">{formatCLP(report.summary.final_value)}</td>
            <td />
          </tr></tfoot>
        </table></div>}
      </section>

      <section className="report-card report-table-card rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-1 text-lg font-semibold">Pagos registrados ({report.summary.paid_count})</h3>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Órdenes marcadas como pagadas entre el {reportPeriod(report)}, aunque el trabajo se haya terminado antes.</p>
        {(report.payment_rows || []).length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay pagos registrados con estos filtros.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"><th className="py-2 pr-3">Fecha de pago</th><th className="py-2 pr-3">Orden</th><th className="py-2 pr-3">Cliente / equipo</th><th className="py-2 pr-3">Técnico</th><th className="py-2 pr-3">Fecha de término</th><th className="py-2 text-right">Monto cobrado</th></tr></thead>
          <tbody>{(report.payment_rows || []).map((row) => <tr key={row.id || row.ticket_number} className="border-b border-zinc-100 dark:border-zinc-800">
            <td className="py-3 pr-3 whitespace-nowrap">{shortDate(row.paid_date)}</td>
            <td className="py-3 pr-3"><button type="button" onClick={() => navigate(`/repairs/${row.id}`)} className="report-order-link font-medium text-blue-600 hover:underline dark:text-blue-400">{row.ticket_number}</button></td>
            <td className="py-3 pr-3">{row.customer_name}<span className="block text-xs text-zinc-500 dark:text-zinc-400">{row.device}</span></td>
            <td className="py-3 pr-3">{row.technician}</td>
            <td className="py-3 pr-3 whitespace-nowrap">{row.finished_date ? shortDate(row.finished_date) : '—'}</td>
            <td className="py-3 text-right whitespace-nowrap">{formatCLP(row.value)}</td>
          </tr>)}</tbody>
          <tfoot><tr className="border-t-2 border-emerald-500 bg-emerald-50 font-bold dark:bg-emerald-950/50">
            <td colSpan={5} className="px-2 py-3">TOTAL COBRADO</td>
            <td className="px-2 py-3 text-right whitespace-nowrap">{formatCLP(report.summary.collected)}</td>
          </tr></tfoot>
        </table></div>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard label="Reparados" value={report.summary.repaired} />
        <ReportCard label="Sin reparación" value={report.summary.not_repaired} />
        <ReportCard label="Entregados en el período" value={report.summary.delivered} />
        <ReportCard label="Costos ingresados" value={formatCLP(report.summary.recorded_cost)} detail="Solo costos que se registraron en las órdenes terminadas." />
      </div>

      {report.daily.length > 0 && <section className="report-card rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-4 text-lg font-semibold">Trabajos terminados por día</h3>
        <div className="h-56" role="img" aria-label="Gráfico de trabajos terminados por día">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#71717a" opacity={0.2} />
              <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} stroke="#71717a" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} stroke="#71717a" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Trabajos" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>}

      {!selectedTechnician && report.by_technician.length > 0 && <section className="report-card rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-semibold">Por técnico</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm">
          <thead><tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"><th className="py-2">Técnico</th><th className="py-2 text-right">Trabajos</th><th className="py-2 text-right">Valor final</th></tr></thead>
          <tbody>{report.by_technician.map((item) => <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800"><td className="py-2">{item.name}</td><td className="py-2 text-right">{item.finished}</td><td className="py-2 text-right">{formatCLP(item.final_value)}</td></tr>)}</tbody>
        </table></div>
      </section>}

      {report.by_issue.length > 0 && <section className="report-card rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-semibold">Fallas atendidas</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.by_issue.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"><span>{item.name}</span><strong>{item.count}</strong></div>)}
        </div>
      </section>}

    </div>}
  </div>;
}

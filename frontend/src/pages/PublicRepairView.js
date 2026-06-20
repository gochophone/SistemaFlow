import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, Calendar, Smartphone, FileText } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  received: { label: 'Recibido', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  diagnosis: { label: 'Diagnóstico', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  in_repair: { label: 'En Reparación', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'Completado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 border-green-200' },
};

const PublicRepairView = () => {
  const { ticketNumber } = useParams();
  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRepair();
  }, [ticketNumber]);

  const fetchRepair = async () => {
    try {
      const response = await axios.get(`${API}/public/repair/${ticketNumber}`);
      setRepair(response.data);
    } catch (error) {
      setError('No se pudo cargar la información de la orden');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-zinc-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error || !repair) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Wrench size={48} className="mx-auto text-zinc-400 mb-4" />
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Orden no encontrada</h2>
            <p className="text-zinc-600">
              No pudimos encontrar la orden {ticketNumber}. Verifica el número e intenta nuevamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-zinc-900 text-white rounded-t-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Wrench size={32} />
            <h1 className="text-2xl font-bold tracking-tight">ServiceTech</h1>
          </div>
          <p className="text-zinc-400 text-sm uppercase tracking-wider">
            Consulta de Orden de Reparación
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-b-lg shadow-lg p-6 space-y-6">
          {/* Ticket Number & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200">
            <div>
              <p className="text-sm text-zinc-500 uppercase tracking-wider mb-1">Número de Orden</p>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                {repair.ticket_number}
              </h2>
            </div>
            <Badge className={`${STATUS_CONFIG[repair.status]?.color} border font-medium text-lg px-4 py-2`}>
              {STATUS_CONFIG[repair.status]?.label || repair.status}
            </Badge>
          </div>

          {/* Customer Info */}
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <FileText size={20} />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-zinc-900">{repair.customer_name}</p>
            </CardContent>
          </Card>

          {/* Device Info */}
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Smartphone size={20} />
                Equipo en Reparación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-zinc-900">
                {repair.device_brand} {repair.device_model}
              </p>
            </CardContent>
          </Card>

          {/* Reported Issue */}
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Problema Reportado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-700 leading-relaxed">{repair.reported_issue}</p>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card className="border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Calendar size={20} />
                Fechas Importantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Fecha de Ingreso</p>
                <p className="text-base font-medium text-zinc-900">{formatDate(repair.received_date)}</p>
              </div>
              {repair.estimated_delivery && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Entrega Estimada</p>
                  <p className="text-base font-medium text-zinc-900">{formatDate(repair.estimated_delivery)}</p>
                </div>
              )}
              {repair.completed_date && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Fecha de Completado</p>
                  <p className="text-base font-medium text-zinc-900">{formatDate(repair.completed_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="pt-6 border-t border-zinc-200 text-center">
            <p className="text-sm text-zinc-600">
              Para más información, contacta directamente con ServiceTech
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Este es un enlace público - No compartas información sensible aquí
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicRepairView;

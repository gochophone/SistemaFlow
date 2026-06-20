import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Trash2, User, Smartphone, FileText, Calendar, Lock, Eye, EyeOff, Camera, ZoomIn, Printer } from 'lucide-react';
import PatternLock from '@/components/PatternLock';
import { formatCLP } from '@/utils/currency';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  received: { label: 'Recibido', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  diagnosis: { label: 'Diagnóstico', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  in_repair: { label: 'En Reparación', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  completed: { label: 'Completado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 border-green-200' },
};

const RepairDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  const [repair, setRepair] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [updateData, setUpdateData] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    fetchRepair();
  }, [id]);

  const fetchRepair = async () => {
    try {
      const response = await axios.get(`${API}/repairs/${id}`, {
        headers: getAuthHeader()
      });
      setRepair(response.data);
      setUpdateData({
        status: response.data.status,
        diagnosis: response.data.diagnosis || '',
        budget_estimate: response.data.budget_estimate || '',
        notes: response.data.notes || '',
        assigned_technician: response.data.assigned_technician || '',
      });
    } catch (error) {
      toast.error('Error al cargar la orden');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const payload = {
        ...updateData,
        budget_estimate: updateData.budget_estimate ? parseFloat(updateData.budget_estimate) : null,
      };
      
      await axios.patch(`${API}/repairs/${id}`, payload, {
        headers: getAuthHeader()
      });
      
      toast.success('Orden actualizada exitosamente');
      setEditDialogOpen(false);
      fetchRepair();
    } catch (error) {
      toast.error('Error al actualizar la orden');
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadDeliveryPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/repairs/${id}/delivery-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orden_entrega_${repair.ticket_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.success('PDF de entrega descargado');
    } catch (error) {
      toast.error('Error al descargar PDF');
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de eliminar esta orden?')) return;
    
    try {
      await axios.delete(`${API}/repairs/${id}`, {
        headers: getAuthHeader()
      });
      toast.success('Orden eliminada');
      navigate('/repairs');
    } catch (error) {
      toast.error('Error al eliminar la orden');
      console.error(error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No establecida';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!repair) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600">Orden no encontrada</p>
        <Button onClick={() => navigate('/repairs')} className="mt-4">Volver</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl" data-testid="repair-detail-page">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/repairs')}
          className="mb-4"
          data-testid="back-button"
        >
          <ArrowLeft size={18} className="mr-2" />
          Volver
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900" data-testid="repair-ticket-number">
              {repair.ticket_number}
            </h1>
            <p className="text-sm text-zinc-600 mt-1 uppercase tracking-wider">Orden de Reparación</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(`/print-label/${repair.id}`, '_blank')}
              data-testid="print-label-button"
              title="Imprimir Etiqueta"
              className="px-3"
            >
              <Printer size={18} />
            </Button>
            
            {repair.status === 'delivered' && (
              <Button
                variant="outline"
                onClick={handleDownloadDeliveryPDF}
                className="border-green-600 text-green-700 hover:bg-green-50"
                data-testid="download-delivery-pdf-button"
              >
                <FileText size={18} className="mr-2" />
                Descargar PDF de Entrega
              </Button>
            )}
            
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="edit-repair-button">
                  <Edit size={18} className="mr-2" />
                  Editar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Actualizar Orden</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-sm font-medium text-zinc-900">Estado</Label>
                    <Select
                      value={updateData.status}
                      onValueChange={(value) => setUpdateData({ ...updateData, status: value })}
                    >
                      <SelectTrigger className="mt-1" data-testid="update-status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-zinc-900">Técnico Asignado</Label>
                    <Input
                      value={updateData.assigned_technician}
                      onChange={(e) => setUpdateData({ ...updateData, assigned_technician: e.target.value })}
                      className="mt-1"
                      data-testid="update-technician-input"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-zinc-900">Diagnóstico</Label>
                    <Textarea
                      value={updateData.diagnosis}
                      onChange={(e) => setUpdateData({ ...updateData, diagnosis: e.target.value })}
                      className="mt-1 min-h-[100px]"
                      data-testid="update-diagnosis-input"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-zinc-900">Presupuesto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={updateData.budget_estimate}
                      onChange={(e) => setUpdateData({ ...updateData, budget_estimate: e.target.value })}
                      className="mt-1"
                      data-testid="update-budget-input"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-zinc-900">Notas</Label>
                    <Textarea
                      value={updateData.notes}
                      onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                      className="mt-1"
                      data-testid="update-notes-input"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setEditDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleUpdate}
                      disabled={updating}
                      className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                      data-testid="save-repair-button"
                    >
                      {updating ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              variant="destructive" 
              onClick={handleDelete}
              data-testid="delete-repair-button"
            >
              <Trash2 size={18} />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-medium">
                <User size={20} />
                Información del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Cliente</p>
                  <p className="text-base font-medium text-zinc-900" data-testid="customer-name">{repair.customer_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-medium">
                <Smartphone size={20} />
                Información del Equipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Marca</p>
                  <p className="text-base font-medium text-zinc-900">{repair.device_brand}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Modelo</p>
                  <p className="text-base font-medium text-zinc-900">{repair.device_model}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">IMEI</p>
                  <p className="text-base font-medium text-zinc-900 font-mono text-sm" data-testid="device-imei">{repair.device_imei}</p>
                </div>
                {repair.device_serial && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Número de Serie</p>
                    <p className="text-base font-medium text-zinc-900 font-mono text-sm">{repair.device_serial}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {repair.device_photos && repair.device_photos.length > 0 && (
            <Card className="bg-white border border-zinc-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-medium">
                  <Camera size={20} />
                  Fotos del Equipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 mb-3">
                  {repair.device_photos.length} foto(s) del estado inicial del equipo
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {repair.device_photos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative group rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => setSelectedPhoto(photo)}
                      data-testid={`device-photo-${index}`}
                    >
                      <img
                        src={photo}
                        alt={`Foto del equipo ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 px-2">
                        Foto {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-medium">
                <FileText size={20} />
                Detalles del Servicio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Problema Reportado</p>
                <p className="text-base text-zinc-900" data-testid="reported-issue">{repair.reported_issue}</p>
              </div>
              {repair.diagnosis && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Diagnóstico</p>
                  <p className="text-base text-zinc-900" data-testid="diagnosis">{repair.diagnosis}</p>
                </div>
              )}
              {repair.notes && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Notas</p>
                  <p className="text-base text-zinc-900">{repair.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(repair.unlock_type && repair.unlock_type !== 'none') && (
            <Card className="bg-white border border-zinc-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-medium">
                  <Lock size={20} />
                  Contraseña de Desbloqueo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Tipo</p>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 border font-medium">
                    {repair.unlock_type === 'numeric' && 'PIN Numérico'}
                    {repair.unlock_type === 'alphanumeric' && 'Contraseña Alfanumérica'}
                    {repair.unlock_type === 'pattern' && 'Patrón de Desbloqueo'}
                  </Badge>
                </div>

                {repair.unlock_type === 'pattern' && repair.unlock_pattern && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Patrón</p>
                    <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                      <PatternLock
                        value={JSON.parse(repair.unlock_pattern)}
                        onChange={() => {}}
                        disabled={true}
                      />
                    </div>
                  </div>
                )}

                {(repair.unlock_type === 'numeric' || repair.unlock_type === 'alphanumeric') && repair.unlock_password && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Contraseña</p>
                    <div className="flex items-center gap-2">
                      <code className={`flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-md font-mono text-lg tracking-wider ${
                        showPassword ? 'text-zinc-900' : 'text-zinc-400'
                      }`}>
                        {showPassword ? repair.unlock_password : '•'.repeat(repair.unlock_password.length)}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="toggle-password-visibility"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs text-amber-900">
                    <strong>Nota:</strong> Esta información es confidencial y solo debe ser usada por técnicos autorizados.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-white border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-medium">Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge 
                className={`${STATUS_CONFIG[repair.status]?.color} border font-medium text-base px-3 py-1`}
                data-testid="current-status-badge"
              >
                {STATUS_CONFIG[repair.status]?.label || repair.status}
              </Badge>
            </CardContent>
          </Card>

          {repair.assigned_technician && (
            <Card className="bg-white border border-zinc-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-medium">Técnico</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-medium text-zinc-900">{repair.assigned_technician}</p>
              </CardContent>
            </Card>
          )}

          {repair.budget_estimate && (
            <Card className="bg-white border border-zinc-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-medium">Presupuesto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-zinc-900" data-testid="budget-estimate">
                  {formatCLP(repair.budget_estimate)}
                </p>
                <p className="text-xs text-zinc-500 mt-1">Pesos Chilenos (CLP)</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-medium">
                <Calendar size={20} />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Fecha de Ingreso</p>
                <p className="text-sm text-zinc-900">{formatDate(repair.received_date)}</p>
              </div>
              {repair.estimated_delivery && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Entrega Estimada</p>
                  <p className="text-sm text-zinc-900">{formatDate(repair.estimated_delivery)}</p>
                </div>
              )}
              {repair.completed_date && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Fecha de Completado</p>
                  <p className="text-sm text-zinc-900">{formatDate(repair.completed_date)}</p>
                </div>
              )}
              {repair.delivered_date && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Fecha de Entrega</p>
                  <p className="text-sm text-zinc-900">{formatDate(repair.delivered_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Photo Viewer Dialog */}
      <Dialog open={selectedPhoto !== null} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista de Foto</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {selectedPhoto && (
              <img
                src={selectedPhoto}
                alt="Vista ampliada"
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepairDetail;

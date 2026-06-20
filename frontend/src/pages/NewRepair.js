import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, User, Smartphone, FileText, Lock, Camera } from 'lucide-react';
import PatternLock from '@/components/PatternLock';
import DevicePhotos from '@/components/DevicePhotos';
import { parseCLPInput } from '@/utils/currency';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NewRepair = () => {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    device_brand: '',
    device_model: '',
    device_imei: '',
    device_serial: '',
    reported_issue: '',
    diagnosis: '',
    budget_estimate: '',
    notes: '',
    unlock_type: 'none',
    unlock_password: '',
    unlock_pattern: [],
    device_photos: [],
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/customers`, {
        headers: getAuthHeader()
      });
      setCustomers(response.data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customer_id: customerId,
      customer_name: customer?.name || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        budget_estimate: formData.budget_estimate ? parseCLPInput(formData.budget_estimate) : null,
        unlock_pattern: formData.unlock_type === 'pattern' ? JSON.stringify(formData.unlock_pattern) : null,
        unlock_password: formData.unlock_type !== 'pattern' && formData.unlock_type !== 'none' ? formData.unlock_password : null,
        device_photos: formData.device_photos.length > 0 ? formData.device_photos : null,
      };

      const response = await axios.post(`${API}/repairs`, payload, {
        headers: getAuthHeader()
      });

      toast.success(`Orden ${response.data.ticket_number} creada exitosamente`);
      navigate(`/repairs/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear la orden');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="max-w-4xl" data-testid="new-repair-page">
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
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Nueva Reparación</h1>
        <p className="text-sm text-zinc-600 mt-1 uppercase tracking-wider">Registrar nueva orden de servicio</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-white border border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-medium">
              <User size={20} />
              Información del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer" className="text-sm font-medium text-zinc-900">Cliente *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={handleCustomerChange}
                  required
                >
                  <SelectTrigger className="mt-1 border-zinc-200" data-testid="customer-select">
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/customers')}
                  className="w-full"
                  data-testid="add-customer-link"
                >
                  + Agregar Nuevo Cliente
                </Button>
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="device_brand" className="text-sm font-medium text-zinc-900">Marca *</Label>
                <Input
                  id="device_brand"
                  value={formData.device_brand}
                  onChange={(e) => updateField('device_brand', e.target.value)}
                  placeholder="Samsung, Apple, Xiaomi..."
                  className="mt-1 border-zinc-200"
                  required
                  data-testid="device-brand-input"
                />
              </div>
              <div>
                <Label htmlFor="device_model" className="text-sm font-medium text-zinc-900">Modelo *</Label>
                <Input
                  id="device_model"
                  value={formData.device_model}
                  onChange={(e) => updateField('device_model', e.target.value)}
                  placeholder="Galaxy S21, iPhone 13..."
                  className="mt-1 border-zinc-200"
                  required
                  data-testid="device-model-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="device_imei" className="text-sm font-medium text-zinc-900">IMEI *</Label>
                <Input
                  id="device_imei"
                  value={formData.device_imei}
                  onChange={(e) => updateField('device_imei', e.target.value)}
                  placeholder="123456789012345"
                  className="mt-1 border-zinc-200 font-mono"
                  required
                  data-testid="device-imei-input"
                />
              </div>
              <div>
                <Label htmlFor="device_serial" className="text-sm font-medium text-zinc-900">Número de Serie</Label>
                <Input
                  id="device_serial"
                  value={formData.device_serial}
                  onChange={(e) => updateField('device_serial', e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 border-zinc-200 font-mono"
                  data-testid="device-serial-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-medium">
              <Camera size={20} />
              Fotos del Equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DevicePhotos
              photos={formData.device_photos}
              onChange={(photos) => setFormData({ ...formData, device_photos: photos })}
              maxPhotos={5}
              authHeader={getAuthHeader()}
            />
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-medium">
              <FileText size={20} />
              Detalles del Servicio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reported_issue" className="text-sm font-medium text-zinc-900">Problema Reportado *</Label>
              <Textarea
                id="reported_issue"
                value={formData.reported_issue}
                onChange={(e) => updateField('reported_issue', e.target.value)}
                placeholder="Describe el problema reportado por el cliente..."
                className="mt-1 border-zinc-200 min-h-[100px]"
                required
                data-testid="reported-issue-input"
              />
            </div>

            <div>
              <Label htmlFor="diagnosis" className="text-sm font-medium text-zinc-900">Diagnóstico Inicial</Label>
              <Textarea
                id="diagnosis"
                value={formData.diagnosis}
                onChange={(e) => updateField('diagnosis', e.target.value)}
                placeholder="Diagnóstico preliminar (opcional)..."
                className="mt-1 border-zinc-200"
                data-testid="diagnosis-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budget_estimate" className="text-sm font-medium text-zinc-900">Presupuesto Estimado (CLP)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                  <Input
                    id="budget_estimate"
                    type="text"
                    inputMode="numeric"
                    value={formData.budget_estimate}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      if (value) {
                        const formatted = new Intl.NumberFormat('es-CL').format(parseInt(value));
                        updateField('budget_estimate', formatted);
                      } else {
                        updateField('budget_estimate', '');
                      }
                    }}
                    placeholder="150.000"
                    className="pl-7 border-zinc-200"
                    data-testid="budget-estimate-input"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">Ejemplo: 150.000 (sin decimales)</p>
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm font-medium text-zinc-900">Notas Adicionales</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Notas internas, accesorios incluidos, condiciones especiales..."
                className="mt-1 border-zinc-200"
                data-testid="notes-input"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-medium">
              <Lock size={20} />
              Contraseña de Desbloqueo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="unlock_type" className="text-sm font-medium text-zinc-900">Tipo de Desbloqueo</Label>
              <Select
                value={formData.unlock_type}
                onValueChange={(value) => setFormData({ ...formData, unlock_type: value, unlock_password: '', unlock_pattern: [] })}
              >
                <SelectTrigger className="mt-1 border-zinc-200" data-testid="unlock-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin contraseña / No especificado</SelectItem>
                  <SelectItem value="numeric">Contraseña Numérica (PIN)</SelectItem>
                  <SelectItem value="alphanumeric">Contraseña Alfanumérica</SelectItem>
                  <SelectItem value="pattern">Patrón de Desbloqueo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.unlock_type === 'numeric' && (
              <div>
                <Label htmlFor="unlock_password" className="text-sm font-medium text-zinc-900">PIN Numérico</Label>
                <Input
                  id="unlock_password"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.unlock_password}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, unlock_password: value });
                  }}
                  placeholder="1234"
                  className="mt-1 border-zinc-200 font-mono text-lg tracking-widest"
                  maxLength="8"
                  data-testid="unlock-password-numeric"
                />
                <p className="text-xs text-zinc-500 mt-1">Solo números (4-8 dígitos)</p>
              </div>
            )}

            {formData.unlock_type === 'alphanumeric' && (
              <div>
                <Label htmlFor="unlock_password" className="text-sm font-medium text-zinc-900">Contraseña Alfanumérica</Label>
                <Input
                  id="unlock_password"
                  type="text"
                  value={formData.unlock_password}
                  onChange={(e) => setFormData({ ...formData, unlock_password: e.target.value })}
                  placeholder="Mi#Contraseña123"
                  className="mt-1 border-zinc-200 font-mono"
                  data-testid="unlock-password-alphanumeric"
                />
                <p className="text-xs text-zinc-500 mt-1">Letras, números y símbolos</p>
              </div>
            )}

            {formData.unlock_type === 'pattern' && (
              <div>
                <Label className="text-sm font-medium text-zinc-900 mb-2 block">
                  Patrón de Desbloqueo
                </Label>
                <p className="text-xs text-zinc-500 mb-3">
                  Dibuja el patrón de desbloqueo del dispositivo. Los números mostrarán el orden de conexión.
                </p>
                <PatternLock
                  value={formData.unlock_pattern}
                  onChange={(pattern) => setFormData({ ...formData, unlock_pattern: pattern })}
                />
              </div>
            )}

            {formData.unlock_type === 'none' && (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-md">
                <p className="text-sm text-zinc-600">
                  No se especificó contraseña de desbloqueo. El cliente puede proporcionarla más tarde o el dispositivo no tiene contraseña.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/repairs')}
            className="flex-1"
            data-testid="cancel-button"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700 font-medium"
            data-testid="submit-repair-button"
          >
            {loading ? 'Creando...' : 'Crear Orden de Reparación'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewRepair;

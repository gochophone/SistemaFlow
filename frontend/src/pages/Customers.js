import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, User } from 'lucide-react';
import { formatRUT, cleanRUT, validateRUT } from '@/utils/rut';

const API = process.env.REACT_APP_BACKEND_URL;

const Customers = () => {
  const { getAuthHeader } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    rut: '',
    address: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/api/customers`, {
        headers: getAuthHeader()
      });
      setCustomers(response.data);
    } catch (error) {
      toast.error('Error al cargar clientes');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', rut: '', address: '' });
    setEditingCustomer(null);
  };

  const handleOpenDialog = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        rut: customer.rut || '',
        address: customer.address || '',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar RUT si se proporcionó
    if (formData.rut && !validateRUT(formData.rut)) {
      toast.error('RUT inválido. Verifica el dígito verificador.');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        rut: formData.rut ? cleanRUT(formData.rut) : null,
      };
      
      if (editingCustomer) {
        await axios.put(`${API}/api/customers/${editingCustomer.id}`, payload, {
          headers: getAuthHeader()
        });
        toast.success('Cliente actualizado');
      } else {
        await axios.post(`${API}/api/customers`, payload, {
          headers: getAuthHeader()
        });
        toast.success('Cliente creado');
      }
      setDialogOpen(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar cliente');
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este cliente?')) return;
    
    try {
      await axios.delete(`${API}/api/customers/${id}`, {
        headers: getAuthHeader()
      });
      toast.success('Cliente eliminado');
      fetchCustomers();
    } catch (error) {
      toast.error('Error al eliminar cliente');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="customers-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Clientes</h1>
          <p className="text-sm text-zinc-600 mt-1 uppercase tracking-wider">
            {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'} registrados
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-blue-600 text-white hover:bg-blue-700 font-medium"
              data-testid="add-customer-button"
            >
              <Plus size={18} className="mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-zinc-900">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Juan Pérez"
                  className="mt-1 border-zinc-200"
                  required
                  data-testid="customer-name-input"
                />
              </div>

              <div>
                <Label htmlFor="rut" className="text-sm font-medium text-zinc-900">RUT</Label>
                <Input
                  id="rut"
                  value={formData.rut}
                  onChange={(e) => {
                    const formatted = formatRUT(e.target.value);
                    setFormData({ ...formData, rut: formatted });
                  }}
                  placeholder="12.345.678-9"
                  className="mt-1 border-zinc-200 font-mono"
                  maxLength="12"
                  data-testid="customer-rut-input"
                />
                <p className="text-xs text-zinc-500 mt-1">Opcional. Formato: 12.345.678-9</p>
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-zinc-900">Teléfono *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+56 9 1234 5678"
                  className="mt-1 border-zinc-200"
                  required
                  data-testid="customer-phone-input"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-zinc-900">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                  className="mt-1 border-zinc-200"
                  data-testid="customer-email-input"
                />
              </div>

              <div>
                <Label htmlFor="address" className="text-sm font-medium text-zinc-900">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle Principal 123"
                  className="mt-1 border-zinc-200"
                  data-testid="customer-address-input"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                  data-testid="save-customer-button"
                >
                  {editingCustomer ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border border-zinc-200 rounded-md shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50">
              <TableHead className="font-semibold text-zinc-900">Nombre</TableHead>
              <TableHead className="font-semibold text-zinc-900">RUT</TableHead>
              <TableHead className="font-semibold text-zinc-900">Teléfono</TableHead>
              <TableHead className="font-semibold text-zinc-900">Email</TableHead>
              <TableHead className="font-semibold text-zinc-900">Dirección</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                  No hay clientes registrados
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow 
                  key={customer.id} 
                  className="hover:bg-zinc-50 transition-colors"
                  data-testid={`customer-row-${customer.name}`}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-zinc-400" />
                      {customer.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {customer.rut ? formatRUT(customer.rut) : '-'}
                  </TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{customer.address || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(customer)}
                        data-testid={`edit-customer-${customer.name}`}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(customer.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-customer-${customer.name}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Customers;

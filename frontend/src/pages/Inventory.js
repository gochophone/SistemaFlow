import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Plus, Edit, Trash2, Package, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { formatCLP, parseCLPInput } from '@/utils/currency';

const API = process.env.REACT_APP_BACKEND_URL;

const Inventory = () => {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    quantity: '',
    price: '',
    location: '',
    min_stock: '5',
    available: true,
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API}/inventory`, {
        headers: getAuthHeader()
      });
      setItems(response.data);
    } catch (error) {
      toast.error('Error al cargar inventario');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', quantity: '', price: '', location: '', min_stock: '5', available: true });
    setEditingItem(null);
  };

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        code: item.code,
        quantity: item.quantity.toString(),
        price: new Intl.NumberFormat('es-CL').format(item.price),
        location: item.location || '',
        min_stock: item.min_stock.toString(),
        available: item.available !== undefined ? item.available : true,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        quantity: parseInt(formData.quantity),
        price: parseCLPInput(formData.price),
        min_stock: parseInt(formData.min_stock),
        available: formData.available,
      };

      if (editingItem) {
        await axios.patch(`${API}/inventory/${editingItem.id}`, payload, {
          headers: getAuthHeader()
        });
        toast.success('Artículo actualizado');
      } else {
        await axios.post(`${API}/inventory`, payload, {
          headers: getAuthHeader()
        });
        toast.success('Artículo creado');
      }
      setDialogOpen(false);
      resetForm();
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar artículo');
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este artículo?')) return;
    
    try {
      await axios.delete(`${API}/inventory/${id}`, {
        headers: getAuthHeader()
      });
      toast.success('Artículo eliminado');
      fetchInventory();
    } catch (error) {
      toast.error('Error al eliminar artículo');
      console.error(error);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await axios.patch(`${API}/inventory/${item.id}`, {
        available: !item.available
      }, {
        headers: getAuthHeader()
      });
      toast.success(item.available ? 'Marcado como no disponible' : 'Marcado como disponible');
      fetchInventory();
    } catch (error) {
      toast.error('Error al actualizar disponibilidad');
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

  const lowStockItems = items.filter(item => item.quantity <= item.min_stock);

  return (
    <div className="space-y-6" data-testid="inventory-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Inventario</h1>
          <p className="text-sm text-zinc-600 mt-1 uppercase tracking-wider">
            {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
            {lowStockItems.length > 0 && (
              <span className="text-red-600 font-semibold ml-2">
                • {lowStockItems.length} con stock bajo
              </span>
            )}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-blue-600 text-white hover:bg-blue-700 font-medium"
              data-testid="add-inventory-button"
            >
              <Plus size={18} className="mr-2" />
              Nuevo Artículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-zinc-900">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Pantalla LCD, Batería..."
                  className="mt-1 border-zinc-200"
                  required
                  data-testid="item-name-input"
                />
              </div>

              <div>
                <Label htmlFor="code" className="text-sm font-medium text-zinc-900">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="LCD-001"
                  className="mt-1 border-zinc-200"
                  required
                  data-testid="item-code-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity" className="text-sm font-medium text-zinc-900">Cantidad *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="mt-1 border-zinc-200"
                    required
                    data-testid="item-quantity-input"
                  />
                </div>

                <div>
                  <Label htmlFor="min_stock" className="text-sm font-medium text-zinc-900">Stock Mínimo *</Label>
                  <Input
                    id="min_stock"
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className="mt-1 border-zinc-200"
                    required
                    data-testid="item-min-stock-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="price" className="text-sm font-medium text-zinc-900">Precio (CLP) *</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                  <Input
                    id="price"
                    type="text"
                    inputMode="numeric"
                    value={formData.price}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      if (value) {
                        const formatted = new Intl.NumberFormat('es-CL').format(parseInt(value));
                        setFormData({ ...formData, price: formatted });
                      } else {
                        setFormData({ ...formData, price: '' });
                      }
                    }}
                    placeholder="25.000"
                    className="pl-7 border-zinc-200"
                    required
                    data-testid="item-price-input"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">Ejemplo: 25.000</p>
              </div>

              <div>
                <Label htmlFor="location" className="text-sm font-medium text-zinc-900">Ubicación</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Estante A, Cajón 3..."
                  className="mt-1 border-zinc-200"
                  data-testid="item-location-input"
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-zinc-200 rounded-md">
                <div className="flex-1">
                  <Label htmlFor="available" className="text-sm font-medium text-zinc-900">
                    Estado de Disponibilidad
                  </Label>
                  <p className="text-xs text-zinc-500 mt-1">
                    {formData.available ? 'Artículo disponible para uso' : 'Artículo no disponible temporalmente'}
                  </p>
                </div>
                <Switch
                  id="available"
                  checked={formData.available}
                  onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                  data-testid="item-available-switch"
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
                  data-testid="save-inventory-button"
                >
                  {editingItem ? 'Actualizar' : 'Crear'}
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
              <TableHead className="font-semibold text-zinc-900">Código</TableHead>
              <TableHead className="font-semibold text-zinc-900">Cantidad</TableHead>
              <TableHead className="font-semibold text-zinc-900">Precio</TableHead>
              <TableHead className="font-semibold text-zinc-900">Ubicación</TableHead>
              <TableHead className="font-semibold text-zinc-900">Stock</TableHead>
              <TableHead className="font-semibold text-zinc-900">Disponibilidad</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                  No hay artículos en el inventario
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isLowStock = item.quantity <= item.min_stock;
                return (
                  <TableRow 
                    key={item.id} 
                    className={`hover:bg-zinc-50 transition-colors ${isLowStock ? 'bg-red-50/50' : ''}`}
                    data-testid={`inventory-row-${item.code}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-zinc-400" />
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell>
                      <span className={isLowStock ? 'text-red-600 font-semibold' : ''}>
                        {item.quantity}
                      </span>
                      <span className="text-zinc-400 text-xs ml-1">/ {item.min_stock}</span>
                    </TableCell>
                    <TableCell className="font-medium">{formatCLP(item.price)}</TableCell>
                    <TableCell>{item.location || '-'}</TableCell>
                    <TableCell>
                      {isLowStock ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200 border font-medium" data-testid="low-stock-badge">
                          <AlertTriangle size={12} className="mr-1" />
                          Stock Bajo
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 border font-medium">
                          <CheckCircle2 size={12} className="mr-1" />
                          Stock OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors hover:bg-zinc-100"
                        data-testid={`toggle-availability-${item.code}`}
                      >
                        {item.available !== undefined && item.available ? (
                          <>
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-700">Disponible</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={16} className="text-red-600" />
                            <span className="text-sm font-medium text-red-700">No Disponible</span>
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(item)}
                          data-testid={`edit-inventory-${item.code}`}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`delete-inventory-${item.code}`}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Inventory;

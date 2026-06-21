import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import DevicePhotos from '@/components/DevicePhotos';
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
import { Plus, Edit, Trash2, Package, AlertTriangle, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react';
import { formatCLP, parseCLPInput } from '@/utils/currency';

const API = process.env.REACT_APP_BACKEND_URL;

const Inventory = () => {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedItemPhotos, setSelectedItemPhotos] = useState({ name: '', photos: [] });
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    quantity: '',
    price: '',
    location: '',
    condition: '10',
    photos: [],
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
    setFormData({ name: '', code: '', quantity: '', price: '', location: '', condition: '10', photos: [], available: true });
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
        condition: item.condition ? item.condition.toString() : '10',
        photos: item.photos || [],
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
        condition: parseInt(formData.condition),
        photos: formData.photos,
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

  const handleViewPhotos = (item) => {
    setSelectedItemPhotos({ name: item.name, photos: item.photos || [] });
    setPhotoModalOpen(true);
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
          <DialogContent className="max-w-2xl p-0 max-h-[95vh] flex flex-col">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>{editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-4 flex-1">
              <form onSubmit={handleSubmit} className="space-y-4" id="inventory-form">
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

              <div>
                <Label htmlFor="quantity" className="text-sm font-medium text-zinc-900">Stock *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="mt-1 border-zinc-200"
                  required
                  data-testid="item-quantity-input"
                  placeholder="Cantidad disponible"
                />
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

              <div className="space-y-2">
                <Label htmlFor="condition" className="text-sm font-medium text-zinc-900">
                  Estado del Producto: {formData.condition}/10
                </Label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500 min-w-[60px]">Malo (1)</span>
                  <input
                    id="condition"
                    type="range"
                    min="1"
                    max="10"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="flex-1 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    data-testid="item-condition-slider"
                  />
                  <span className="text-xs text-zinc-500 min-w-[80px] text-right">Excelente (10)</span>
                </div>
                <div className="flex items-center gap-2">
                  {parseInt(formData.condition) <= 3 && (
                    <Badge className="bg-red-100 text-red-800 border-red-200">Malo</Badge>
                  )}
                  {parseInt(formData.condition) >= 4 && parseInt(formData.condition) <= 6 && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">Regular</Badge>
                  )}
                  {parseInt(formData.condition) >= 7 && parseInt(formData.condition) <= 8 && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">Bueno</Badge>
                  )}
                  {parseInt(formData.condition) >= 9 && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Excelente</Badge>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-zinc-900 mb-2 block">
                  Fotos del Producto
                </Label>
                <DevicePhotos
                  photos={formData.photos}
                  onChange={(photos) => setFormData({ ...formData, photos })}
                  maxPhotos={5}
                  authHeader={getAuthHeader()}
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

              <div className="flex gap-2 pt-4 border-t mt-6">
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
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border border-zinc-200 rounded-md shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50">
              <TableHead className="font-semibold text-zinc-900">Nombre</TableHead>
              <TableHead className="font-semibold text-zinc-900">Código</TableHead>
              <TableHead className="font-semibold text-zinc-900">Stock</TableHead>
              <TableHead className="font-semibold text-zinc-900">Estado</TableHead>
              <TableHead className="font-semibold text-zinc-900">Fotos</TableHead>
              <TableHead className="font-semibold text-zinc-900">Precio</TableHead>
              <TableHead className="font-semibold text-zinc-900">Ubicación</TableHead>
              <TableHead className="font-semibold text-zinc-900">Inventario</TableHead>
              <TableHead className="font-semibold text-zinc-900">Disponibilidad</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-zinc-500">
                  No hay artículos en el inventario
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isLowStock = item.quantity === 1; // Solo mostrar "Stock Bajo" cuando queda 1
                const isOutOfStock = item.quantity === 0; // Sin stock
                return (
                  <TableRow 
                    key={item.id} 
                    className={`hover:bg-zinc-50 transition-colors ${
                      isOutOfStock ? 'bg-red-50/50' : isLowStock ? 'bg-orange-50/50' : ''
                    }`}
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
                      <span className={isOutOfStock ? 'text-red-700 font-bold' : isLowStock ? 'text-orange-600 font-semibold' : ''}>
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.condition || 10}/10</span>
                        {item.condition >= 9 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">Excelente</Badge>
                        ) : item.condition >= 7 ? (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Bueno</Badge>
                        ) : item.condition >= 4 ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Regular</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Malo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.photos && item.photos.length > 0 ? (
                        <button
                          onClick={() => handleViewPhotos(item)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-100 transition-colors group"
                          data-testid={`view-photos-${item.code}`}
                        >
                          <div className="relative">
                            <ImageIcon size={18} className="text-blue-600 group-hover:text-blue-700" />
                            <Badge className="absolute -top-1 -right-2 h-4 min-w-[16px] flex items-center justify-center text-[10px] px-1 bg-blue-600 hover:bg-blue-600">
                              {item.photos.length}
                            </Badge>
                          </div>
                          <span className="text-sm text-zinc-700 group-hover:text-zinc-900">Ver fotos</span>
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Sin fotos</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatCLP(item.price)}</TableCell>
                    <TableCell>{item.location || '-'}</TableCell>
                    <TableCell>
                      {isOutOfStock ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200 border font-medium" data-testid="out-of-stock-badge">
                          <XCircle size={12} className="mr-1" />
                          Sin Stock
                        </Badge>
                      ) : isLowStock ? (
                        <Badge className="bg-orange-100 text-orange-800 border-orange-200 border font-medium" data-testid="low-stock-badge">
                          <AlertTriangle size={12} className="mr-1" />
                          Stock Bajo (1)
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 border font-medium">
                          <CheckCircle2 size={12} className="mr-1" />
                          Stock OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOutOfStock ? (
                        <div className="flex items-center gap-2 text-zinc-400" title="No disponible - Sin stock">
                          <XCircle size={16} className="text-zinc-400" />
                          <span className="text-sm font-medium">No Disponible</span>
                        </div>
                      ) : (
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
                      )}
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

      {/* Modal de Galería de Fotos */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Fotos de {selectedItemPhotos.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedItemPhotos.photos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {selectedItemPhotos.photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo}
                    alt={`Foto ${index + 1} de ${selectedItemPhotos.name}`}
                    className="w-full h-64 object-cover rounded-lg border border-zinc-200"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                    <a
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 bg-white px-4 py-2 rounded-md text-sm font-medium shadow-lg transition-opacity"
                    >
                      Ver en tamaño completo
                    </a>
                  </div>
                  <Badge className="absolute top-2 right-2 bg-black/70 text-white">
                    {index + 1} de {selectedItemPhotos.photos.length}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <ImageIcon size={48} className="mx-auto mb-4 text-zinc-300" />
              <p>No hay fotos disponibles</p>
            </div>
          )}
          
          <div className="flex justify-end mt-6">
            <Button onClick={() => setPhotoModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;

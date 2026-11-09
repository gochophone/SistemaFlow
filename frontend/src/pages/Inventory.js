import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DevicePhotos from '@/components/DevicePhotos';
import InventoryNameSelector from '@/components/InventoryNameSelector';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Package, Image as ImageIcon } from 'lucide-react';
import { formatCLP, parseCLPInput } from '@/utils/currency';

const API = process.env.REACT_APP_BACKEND_URL;
const formatPriceInput = (value) => {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? new Intl.NumberFormat('es-CL').format(Number(digits)) : '';
};
const conditionLabel = (condition) => {
  if (condition >= 9) return 'Excelente';
  if (condition >= 7) return 'Bueno';
  if (condition >= 4) return 'Regular';
  return 'Malo';
};

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
    quantity: '',
    purchase_price: '',
    price: '',
    description: '',
    location: '',
    condition: '10',
    photos: [],
    available: true,
  });

  useEffect(() => {
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API}/api/inventory`, {
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
    setFormData({ name: '', quantity: '', purchase_price: '', price: '', description: '', location: '', condition: '10', photos: [], available: true });
    setEditingItem(null);
  };

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        quantity: String(item.quantity ?? ''),
        purchase_price: item.purchase_price == null ? '' : new Intl.NumberFormat('es-CL').format(item.purchase_price),
        price: item.price == null ? '' : new Intl.NumberFormat('es-CL').format(item.price),
        description: item.description || '',
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
        name: formData.name.trim(),
        quantity: formData.quantity === '' ? 0 : parseInt(formData.quantity, 10),
        purchase_price: formData.purchase_price === '' ? null : parseCLPInput(formData.purchase_price),
        price: formData.price === '' ? null : parseCLPInput(formData.price),
        description: formData.description.trim() || null,
        condition: parseInt(formData.condition),
        photos: formData.photos,
        available: formData.available,
      };

      if (editingItem) {
        await axios.patch(`${API}/api/inventory/${editingItem.id}`, payload, {
          headers: getAuthHeader()
        });
        toast.success('Artículo actualizado');
      } else {
        await axios.post(`${API}/api/inventory`, payload, {
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
      await axios.delete(`${API}/api/inventory/${id}`, {
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
      await axios.patch(`${API}/api/inventory/${item.id}`, {
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

  return (
    <div className="space-y-6" data-testid="inventory-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Inventario</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 uppercase tracking-wider">
            {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
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
              <DialogDescription>Completa los datos que tengas; puedes añadir los demás después.</DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto px-6 py-4 flex-1">
              <form onSubmit={handleSubmit} className="space-y-4" id="inventory-form">
              <InventoryNameSelector value={formData.name}
                onChange={(name) => setFormData((current) => ({ ...current, name }))}
                existingNames={items.map((item) => item.name).filter((name) => name !== 'Artículo sin nombre')} />

              <div>
                <Label htmlFor="quantity" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Stock</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="mt-1 border-zinc-200"
                  data-testid="item-quantity-input"
                  placeholder="Cantidad disponible"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="purchase-price" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Precio de compra (CLP)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                    <Input id="purchase-price" type="text" inputMode="numeric" value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: formatPriceInput(e.target.value) })}
                      placeholder="15.000" className="pl-7 border-zinc-200" data-testid="item-purchase-price-input" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="price" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Precio final (CLP)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-medium">$</span>
                    <Input id="price" type="text" inputMode="numeric" value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: formatPriceInput(e.target.value) })}
                      placeholder="25.000" className="pl-7 border-zinc-200" data-testid="item-price-input" />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Descripción</Label>
                <Textarea id="description" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  maxLength={1000} placeholder="Características o detalles del artículo"
                  className="mt-1 border-zinc-200" data-testid="item-description-input" />
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
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{conditionLabel(Number(formData.condition))}</p>
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
              <TableHead className="font-semibold text-zinc-900">Compra</TableHead>
              <TableHead className="font-semibold text-zinc-900">Precio final</TableHead>
              <TableHead className="font-semibold text-zinc-900">Ubicación</TableHead>
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
                const isOutOfStock = item.quantity === 0;
                return (
                  <TableRow 
                    key={item.id} 
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors"
                    data-testid={`inventory-row-${item.code}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-zinc-400" />
                        <div>
                          <span>{item.name}</span>
                          {item.description && <p className="max-w-xs truncate text-xs font-normal text-zinc-500 dark:text-zinc-400" title={item.description}>{item.description}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>
                      <span className="text-sm">{item.condition ?? 10}/10 · {conditionLabel(item.condition ?? 10)}</span>
                    </TableCell>
                    <TableCell>
                      {item.photos && item.photos.length > 0 ? (
                        <button
                          onClick={() => handleViewPhotos(item)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors group"
                          data-testid={`view-photos-${item.code}`}
                        >
                          <div className="relative">
                            <ImageIcon size={18} className="text-blue-600 group-hover:text-blue-700" />
                            <Badge className="absolute -top-1 -right-2 h-4 min-w-[16px] flex items-center justify-center text-[10px] px-1 bg-blue-600 hover:bg-blue-600">
                              {item.photos.length}
                            </Badge>
                          </div>
                          <span className="text-sm text-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">Ver fotos</span>
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Sin fotos</span>
                      )}
                    </TableCell>
                    <TableCell>{item.purchase_price == null ? '—' : formatCLP(item.purchase_price)}</TableCell>
                    <TableCell className="font-medium">{item.price == null ? '—' : formatCLP(item.price)}</TableCell>
                    <TableCell>{item.location || '-'}</TableCell>
                    <TableCell>
                      {isOutOfStock ? (
                        <span className="text-sm text-zinc-500" title="Sin unidades disponibles">Sin unidades</span>
                      ) : (
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          data-testid={`toggle-availability-${item.code}`}
                        >
                          {item.available !== false ? 'Disponible' : 'No disponible'}
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
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/40"
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
            <DialogDescription>Imágenes guardadas para este artículo.</DialogDescription>
          </DialogHeader>
          
          {selectedItemPhotos.photos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {selectedItemPhotos.photos.map((photo, photoIndex) => (
                <div key={photo} className="relative group">
                  <img
                    src={photo}
                    alt={`Foto ${photoIndex + 1} de ${selectedItemPhotos.name}`}
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
                    {photoIndex + 1} de {selectedItemPhotos.photos.length}
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

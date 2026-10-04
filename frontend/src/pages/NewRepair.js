import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createWorker } from 'tesseract.js';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, User, Smartphone, FileText, Lock, Camera, Check, ChevronsUpDown, Loader2, ScanLine } from 'lucide-react';
import PatternLock from '@/components/PatternLock';
import DevicePhotos from '@/components/DevicePhotos';
import { parseCLPInput } from '@/utils/currency';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { validateRUT, cleanRUT } from '@/utils/rut';

const API = process.env.REACT_APP_BACKEND_URL;

const CUSTOM_OPTION = '__custom__';

const DEVICE_MODELS = {
  Apple: [
    'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
    'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max', 'iPhone SE (2.ª generación)',
    'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
    'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone SE (3.ª generación)',
    'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
    'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
    'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 16e',
    'iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone 17e', 'iPhone Air',
    'iPhone 18 Pro', 'iPhone 18 Pro Max', 'iPhone Duo', 'iPad'
  ],
  Samsung: ['Galaxy A05', 'Galaxy A15', 'Galaxy A25', 'Galaxy A35', 'Galaxy A55', 'Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy S24', 'Galaxy S25', 'Galaxy Z Flip', 'Galaxy Z Fold'],
  Xiaomi: ['Redmi 12', 'Redmi 13C', 'Redmi Note 12', 'Redmi Note 13', 'Redmi Note 14', 'POCO X6', 'POCO X7', 'Xiaomi 13', 'Xiaomi 14'],
  Motorola: ['Moto G14', 'Moto G24', 'Moto G34', 'Moto G54', 'Moto G84', 'Moto Edge 40', 'Moto Edge 50'],
  Huawei: ['P30', 'P40', 'P50', 'Nova 9', 'Nova 11', 'Nova 12', 'Mate 40'],
  OPPO: ['A38', 'A58', 'A78', 'Reno 8', 'Reno 10', 'Reno 11', 'Reno 12'],
  vivo: ['Y17s', 'Y27', 'Y36', 'Y51', 'V25', 'V29', 'V30'],
  realme: ['C51', 'C53', 'C55', 'C67', '11 Pro', '12 Pro'],
  HONOR: ['X6', 'X7', 'X8', 'X9', '90', '200', 'Magic V2'],
  Google: ['Pixel 6', 'Pixel 7', 'Pixel 8', 'Pixel 9', 'Pixel Fold'],
  OnePlus: ['Nord CE 3', 'Nord CE 4', '10 Pro', '11', '12', '13'],
  Nokia: ['G22', 'G42', 'X30'],
  ZTE: ['Blade A54', 'Blade A73', 'Blade V50'],
  TCL: ['30 SE', '40 SE', '50 Pro'],
  Tecno: ['Spark 10', 'Spark 20', 'Spark 30', 'Pova 5'],
  Infinix: ['Hot 30', 'Hot 40', 'Note 30', 'Note 40'],
  LG: ['K42', 'K52', 'Velvet'],
  Sony: ['Xperia 10', 'Xperia 1'],
  ASUS: ['ROG Phone 6', 'ROG Phone 7', 'Zenfone 9', 'Zenfone 10'],
};

const DEVICE_BRANDS = Object.keys(DEVICE_MODELS);

const hasValidImeiChecksum = (value) => {
  if (!/^\d{15}$/.test(value)) return false;
  const total = value.split('').reduce((sum, digit, index) => {
    let number = Number(digit);
    if (index % 2 === 1) {
      number *= 2;
      if (number > 9) number -= 9;
    }
    return sum + number;
  }, 0);
  return total % 10 === 0;
};

const extractScanCandidates = (text, targetField = 'device_imei') => {
  const isSerialScan = targetField === 'device_serial';
  const candidates = new Map();
  const addCandidate = (rawValue, { labelled = false } = {}) => {
    const sourceValue = String(rawValue || '').trim().toUpperCase();
    const value = isSerialScan
      ? sourceValue.replace(/[^A-Z0-9._\/-]/g, '')
      : sourceValue.replace(/[^A-Z0-9]/g, '');
    if (value.length < 6 || value.length > 32 || (!/\d/.test(value) && !labelled)) return;
    const numeric = /^\d+$/.test(value);
    const validImei = hasValidImeiChecksum(value);
    const alphanumeric = /[A-Z]/.test(value) && /\d/.test(value);
    const score = isSerialScan
      ? labelled ? 340 : alphanumeric ? 240 : validImei ? 110 : numeric ? 140 : 80
      : labelled ? 340 : validImei ? 300 : numeric && value.length === 15 ? 240 : numeric && value.length >= 14 && value.length <= 17 ? 180 : 80;
    const current = candidates.get(value);
    if (!current || score > current.score) candidates.set(value, {
      value,
      numeric,
      validImei,
      labelledSerial: isSerialScan && labelled,
      score,
    });
  };

  const normalizePossibleImei = (value) => String(value || '')
    .toUpperCase()
    .replace(/[OQD]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/B/g, '8')
    .replace(/[^0-9]/g, '');

  String(text || '').split(/\r?\n/).forEach((line) => {
    const upperLine = line.toUpperCase();
    const labelledImeiPattern = /\bIMEI(?:\s*[12])?\s*[:#-]?\s*([A-Z0-9](?:[\s.-]?[A-Z0-9]){13,16})/g;
    Array.from(upperLine.matchAll(labelledImeiPattern)).forEach((match) => {
      const possibleImei = normalizePossibleImei(match[1]);
      if (possibleImei.length === 15) addCandidate(possibleImei, { labelled: !isSerialScan });
    });

    const labelledSerialPattern = /\b(?:SERIAL(?:\s*(?:NO|NUMBER))?|S\/N|SN|NUMERO\s+DE\s+SERIE)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{4,31})/g;
    Array.from(upperLine.matchAll(labelledSerialPattern)).forEach((match) => {
      addCandidate(match[1], { labelled: isSerialScan });
    });

    const separatedImeiPattern = /(?:^|[^0-9])((?:\d[\s.-]*){14}\d)(?=$|[^0-9])/g;
    Array.from(upperLine.matchAll(separatedImeiPattern)).forEach((match) => addCandidate(match[1]));

    (upperLine.match(/[A-Z0-9]{6,24}/g) || []).forEach((token) => {
      addCandidate(token);
      if (token.length === 15 && (token.match(/\d/g) || []).length >= 11) {
        const possibleImei = normalizePossibleImei(token);
        if (possibleImei.length === 15) addCandidate(possibleImei);
      }
    });
  });

  return Array.from(candidates.values())
    .sort((first, second) => second.score - first.score || first.value.localeCompare(second.value))
    .slice(0, 16);
};

const NewRepair = () => {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [repairCounts, setRepairCounts] = useState({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSelectorOpen, setCustomerSelectorOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', rut: '', address: '' });
  const [brandChoice, setBrandChoice] = useState('');
  const [modelChoice, setModelChoice] = useState('');
  const [scanTarget, setScanTarget] = useState('device_imei');
  const [imeiScannerOpen, setImeiScannerOpen] = useState(false);
  const [imeiScanning, setImeiScanning] = useState(false);
  const [imeiScanProgress, setImeiScanProgress] = useState(0);
  const [imeiPreview, setImeiPreview] = useState('');
  const [imeiCandidates, setImeiCandidates] = useState([]);
  const [imeiRecognizedText, setImeiRecognizedText] = useState('');
  const imeiWorkerRef = useRef(null);
  const imeiScanRunRef = useRef(0);

  const createCustomer = async (event) => {
    event.preventDefault();
    if (savingCustomer) return;
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error('Completa el nombre y el teléfono del cliente.');
      return;
    }
    if (newCustomer.rut && !validateRUT(newCustomer.rut)) {
      toast.error('RUT inválido. Verifica el dígito verificador.');
      return;
    }
    setSavingCustomer(true);
    try {
      const { data: customer } = await axios.post(API + '/api/customers', {
        ...newCustomer,
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim(),
        rut: newCustomer.rut ? cleanRUT(newCustomer.rut) : null,
      }, { headers: getAuthHeader() });
      setCustomers(current => [...current.filter(item => item.id !== customer.id), customer]);
      setFormData(current => ({ ...current, customer_id: customer.id, customer_name: customer.name }));
      setCustomerOpen(false);
      setNewCustomer({ name: '', phone: '', email: '', rut: '', address: '' });
      toast.success('Cliente creado y seleccionado.');
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'No se pudo crear el cliente. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setSavingCustomer(false);
    }
  };
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
    notes_private: false,
    unlock_type: 'none',
    unlock_password: '',
    unlock_pattern: [],
    device_photos: [],
  });

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    imeiScanRunRef.current += 1;
    if (imeiWorkerRef.current) {
      imeiWorkerRef.current.terminate();
      imeiWorkerRef.current = null;
    }
  }, []);

  const prepareImeiImage = async (file) => {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      if (scale === 1) {
        bitmap.close();
        return file;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.9));
    } catch (error) {
      return file;
    }
  };

  const cancelImeiScan = async () => {
    imeiScanRunRef.current += 1;
    const worker = imeiWorkerRef.current;
    imeiWorkerRef.current = null;
    setImeiScanning(false);
    setImeiScannerOpen(false);
    if (worker) await worker.terminate();
  };

  const fetchCustomers = async () => {
    try {
      const config = { headers: getAuthHeader() };
      const [customerResponse, repairResponse] = await Promise.all([
        axios.get(`${API}/api/customers`, config),
        axios.get(`${API}/api/repairs`, config),
      ]);
      setCustomers(customerResponse.data);
      setRepairCounts(repairResponse.data.reduce((counts, repair) => ({
        ...counts,
        [repair.customer_id]: (counts[repair.customer_id] || 0) + 1,
      }), {}));
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  };

  const normalizedCustomerSearch = customerSearch.trim().toLocaleLowerCase('es');
  const matchingCustomers = customers
    .filter((customer) => {
      if (!normalizedCustomerSearch) return true;
      return `${customer.name} ${customer.phone} ${customer.email || ''} ${customer.rut || ''}`
        .toLocaleLowerCase('es')
        .includes(normalizedCustomerSearch);
    });
  const byFrequency = (first, second) => {
      const countDifference = (repairCounts[second.id] || 0) - (repairCounts[first.id] || 0);
      return countDifference || first.name.localeCompare(second.name, 'es');
  };
  const frequentCustomers = matchingCustomers.filter((customer) => repairCounts[customer.id]).sort(byFrequency);
  const otherCustomers = matchingCustomers.filter((customer) => !repairCounts[customer.id]).sort((first, second) => first.name.localeCompare(second.name, 'es'));

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

      const response = await axios.post(`${API}/api/repairs`, payload, {
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

  const handleBrandChange = (value) => {
    setBrandChoice(value);
    setModelChoice('');
    setFormData(current => ({
      ...current,
      device_brand: value === CUSTOM_OPTION ? '' : value,
      device_model: '',
    }));
  };

  const handleModelChange = (value) => {
    setModelChoice(value);
    updateField('device_model', value === CUSTOM_OPTION ? '' : value);
  };

  const handleScanPhoto = async (event, targetField) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona o toma una fotografía.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error('La fotografía no puede superar los 12 MB.');
      return;
    }

    setScanTarget(targetField);
    const scanRun = imeiScanRunRef.current + 1;
    imeiScanRunRef.current = scanRun;
    const image = await prepareImeiImage(file);
    const reader = new FileReader();
    reader.onload = () => setImeiPreview(String(reader.result || ''));
    reader.readAsDataURL(image);
    setImeiCandidates([]);
    setImeiRecognizedText('');
    setImeiScanProgress(0);
    setImeiScannerOpen(true);
    setImeiScanning(true);

    try {
      if (!imeiWorkerRef.current) {
        const worker = await createWorker('eng', 1, {
          logger: (message) => {
            if (typeof message.progress === 'number') setImeiScanProgress(Math.round(message.progress * 100));
          },
        });
        if (imeiScanRunRef.current !== scanRun) {
          await worker.terminate();
          return;
        }
        imeiWorkerRef.current = worker;
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:/# ',
        });
      }
      const worker = imeiWorkerRef.current;
      const result = await worker.recognize(image);
      if (imeiScanRunRef.current !== scanRun) return;
      const recognizedText = result.data?.text || '';
      const candidates = extractScanCandidates(recognizedText, targetField);
      setImeiRecognizedText(recognizedText.trim());
      setImeiCandidates(candidates);
      if (candidates.length === 0) toast.error('No se detectaron letras o números claros. Acerca la cámara y evita reflejos.');
    } catch (error) {
      if (imeiScanRunRef.current !== scanRun) return;
      console.error('Error al escanear el identificador:', error);
      const fieldLabel = targetField === 'device_serial' ? 'número de serie' : 'IMEI';
      toast.error(`No se pudo leer la imagen. Puedes intentarlo nuevamente o escribir el ${fieldLabel}.`);
      if (imeiWorkerRef.current) await imeiWorkerRef.current.terminate();
      imeiWorkerRef.current = null;
    } finally {
      if (imeiScanRunRef.current === scanRun) setImeiScanning(false);
    }
  };

  const selectScanCandidate = (candidate) => {
    updateField(scanTarget, candidate.value);
    setImeiScannerOpen(false);
    const fieldLabel = scanTarget === 'device_serial' ? 'Número de serie' : 'IMEI';
    toast.success(`${fieldLabel} completado: ${candidate.value}`);
  };

  const scanTargetLabel = scanTarget === 'device_serial' ? 'número de serie' : 'IMEI';

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
                <Popover open={customerSelectorOpen} onOpenChange={setCustomerSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSelectorOpen}
                      className="mt-1 w-full justify-between border-zinc-200 font-normal"
                      data-testid="customer-select"
                    >
                      {formData.customer_id ? `${formData.customer_name} — ${customers.find((customer) => customer.id === formData.customer_id)?.rut || customers.find((customer) => customer.id === formData.customer_id)?.phone || ''}` : 'Seleccionar cliente'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar cliente por nombre, teléfono, correo o RUT..."
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                        data-testid="customer-search"
                      />
                      <CommandList>
                        <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                        {frequentCustomers.length > 0 && <CommandGroup heading="Clientes frecuentes">
                          {frequentCustomers.map((customer) => (
                            <CommandItem key={customer.id} value={customer.id} onSelect={() => {
                              handleCustomerChange(customer.id);
                              setCustomerSearch('');
                              setCustomerSelectorOpen(false);
                            }}>
                              <Check className={`mr-1 h-4 w-4 ${formData.customer_id === customer.id ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="min-w-0 flex-1 truncate">{customer.name} — {customer.rut || customer.phone}</span>
                              <span className="text-xs text-zinc-500">{repairCounts[customer.id]} rep.</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>}
                        {otherCustomers.length > 0 && <CommandGroup heading={frequentCustomers.length ? 'Todos los clientes' : 'Clientes'}>
                          {otherCustomers.map((customer) => (
                            <CommandItem key={customer.id} value={customer.id} onSelect={() => {
                              handleCustomerChange(customer.id);
                              setCustomerSearch('');
                              setCustomerSelectorOpen(false);
                            }}>
                              <Check className={`mr-1 h-4 w-4 ${formData.customer_id === customer.id ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="truncate">{customer.name} — {customer.rut || customer.phone}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCustomerOpen(true)}
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
                <Select value={brandChoice} onValueChange={handleBrandChange} required>
                  <SelectTrigger className="mt-1 border-zinc-200" data-testid="device-brand-select">
                    <SelectValue placeholder="Seleccionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_BRANDS.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
                    <SelectItem value={CUSTOM_OPTION}>Otra / especificar</SelectItem>
                  </SelectContent>
                </Select>
                {brandChoice === CUSTOM_OPTION && (
                  <Input
                    id="device_brand"
                    value={formData.device_brand}
                    onChange={(e) => updateField('device_brand', e.target.value)}
                    placeholder="Escribe la marca"
                    className="mt-2 border-zinc-200"
                    required
                    data-testid="device-brand-input"
                  />
                )}
              </div>
              <div>
                <Label htmlFor="device_model" className="text-sm font-medium text-zinc-900">Modelo *</Label>
                {brandChoice && brandChoice !== CUSTOM_OPTION ? (
                  <>
                    <Select value={modelChoice} onValueChange={handleModelChange} required>
                      <SelectTrigger className="mt-1 border-zinc-200" data-testid="device-model-select">
                        <SelectValue placeholder="Seleccionar modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(DEVICE_MODELS[brandChoice] || []).map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                        <SelectItem value={CUSTOM_OPTION}>Otro / especificar</SelectItem>
                      </SelectContent>
                    </Select>
                    {modelChoice === CUSTOM_OPTION && (
                      <Input
                        id="device_model"
                        value={formData.device_model}
                        onChange={(e) => updateField('device_model', e.target.value)}
                        placeholder={`Escribe el modelo ${brandChoice}`}
                        className="mt-2 border-zinc-200"
                        required
                        data-testid="device-model-input"
                      />
                    )}
                  </>
                ) : (
                  <Input
                    id="device_model"
                    value={formData.device_model}
                    onChange={(e) => updateField('device_model', e.target.value)}
                    placeholder={brandChoice === CUSTOM_OPTION ? 'Escribe el modelo' : 'Primero selecciona una marca'}
                    className="mt-1 border-zinc-200"
                    disabled={!brandChoice}
                    required
                    data-testid="device-model-input"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="device_imei" className="text-sm font-medium text-zinc-900">IMEI</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="device_imei"
                    value={formData.device_imei}
                    onChange={(e) => updateField('device_imei', e.target.value)}
                    placeholder="Opcional"
                    className="border-zinc-200 font-mono"
                    data-testid="device-imei-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => document.getElementById('imei-camera-input')?.click()}
                    data-testid="scan-imei-button"
                  >
                    <ScanLine size={17} className="mr-2" />Escanear
                  </Button>
                  <input
                    id="imei-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => handleScanPhoto(event, 'device_imei')}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">Abre la cámara, fotografía el IMEI y elige el número correcto.</p>
              </div>
              <div>
                <Label htmlFor="device_serial" className="text-sm font-medium text-zinc-900">Número de Serie</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="device_serial"
                    value={formData.device_serial}
                    onChange={(e) => updateField('device_serial', e.target.value)}
                    placeholder="Opcional"
                    className="border-zinc-200 font-mono"
                    data-testid="device-serial-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => document.getElementById('serial-camera-input')?.click()}
                    data-testid="scan-serial-button"
                  >
                    <ScanLine size={17} className="mr-2" />Escanear
                  </Button>
                  <input
                    id="serial-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => handleScanPhoto(event, 'device_serial')}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">Abre la cámara, fotografía el número de serie y elige el dato correcto.</p>
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
                placeholder="Accesorios incluidos, condiciones especiales..."
                className="mt-1 border-zinc-200"
                data-testid="notes-input"
              />
              <div className="mt-3 flex items-center gap-3">
                <Switch id="notes-private" checked={formData.notes_private} onCheckedChange={(checked) => updateField('notes_private', checked)} data-testid="notes-private-switch" />
                <Label htmlFor="notes-private" className="text-sm dark:text-zinc-100">Nota privada: no aparece en el PDF de entrega</Label>
              </div>
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
      <Dialog open={imeiScannerOpen} onOpenChange={(open) => { if (open) setImeiScannerOpen(true); else if (imeiScanning) cancelImeiScan(); else setImeiScannerOpen(false); }}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanLine size={20} />Escanear {scanTargetLabel}</DialogTitle>
            <DialogDescription>La fotografía se procesa en este dispositivo. Selecciona el dato correcto para copiarlo al campo {scanTargetLabel}.</DialogDescription>
          </DialogHeader>

          {imeiPreview && <img src={imeiPreview} alt={`Fotografía para leer el ${scanTargetLabel}`} className="max-h-56 w-full rounded-md border border-zinc-200 object-contain" />}

          {imeiScanning ? (
            <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <div className="flex items-center gap-2 font-medium"><Loader2 size={18} className="animate-spin" />Leyendo letras y números…</div>
              <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(5, imeiScanProgress)}%` }} />
              </div>
              <p className="text-xs">{imeiScanProgress}% — La primera lectura puede tardar unos segundos.</p>
              <Button type="button" variant="outline" className="w-full border-blue-300 bg-white" onClick={cancelImeiScan}>Cancelar lectura</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-900">Datos detectados</p>
              {imeiCandidates.length > 0 ? (
                <div className="grid gap-2">
                  {imeiCandidates.map((candidate) => (
                    <button
                      type="button"
                      key={candidate.value}
                      onClick={() => selectScanCandidate(candidate)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
                    >
                      <span className="break-all font-mono text-base font-semibold text-zinc-900">{candidate.value}</span>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${(scanTarget === 'device_imei' && candidate.validImei) || candidate.labelledSerial ? 'bg-emerald-100 text-emerald-800' : candidate.numeric ? 'bg-blue-100 text-blue-800' : 'bg-zinc-100 text-zinc-700'}`}>
                        {scanTarget === 'device_imei' && candidate.validImei ? 'IMEI válido' : candidate.labelledSerial ? 'Serie detectada' : candidate.numeric ? 'Número' : 'Letras y números'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No se encontraron datos claros en la fotografía.</p>
              )}

              {imeiRecognizedText && (
                <details className="rounded-md border border-zinc-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-zinc-700">Ver todo el texto reconocido</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-600">{imeiRecognizedText}</pre>
                </details>
              )}

              <Button type="button" variant="outline" className="w-full" onClick={() => document.getElementById(scanTarget === 'device_serial' ? 'serial-camera-input' : 'imei-camera-input')?.click()}>
                <Camera size={17} className="mr-2" />Tomar otra fotografía
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={customerOpen} onOpenChange={open => { if (!savingCustomer) setCustomerOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Al guardar, el cliente quedará seleccionado en esta reparación. Los datos de la orden se conservarán.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createCustomer} className="space-y-4" data-testid="new-repair-customer-form">
            {[
              ['name', 'Nombre *', 'text', true],
              ['phone', 'Teléfono *', 'tel', true],
              ['email', 'Email', 'email', false],
              ['rut', 'RUT', 'text', false],
              ['address', 'Dirección', 'text', false],
            ].map(([field, label, type, required]) => (
              <div key={field}>
                <Label htmlFor={'repair-customer-' + field}>{label}</Label>
                <Input id={'repair-customer-' + field} type={type} required={required}
                  disabled={savingCustomer} value={newCustomer[field]}
                  onChange={event => setNewCustomer(current => ({ ...current, [field]: event.target.value }))} />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={savingCustomer} onClick={() => setCustomerOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingCustomer}>{savingCustomer ? 'Guardando...' : 'Guardar y seleccionar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewRepair;

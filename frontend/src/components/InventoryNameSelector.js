import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchField } from '@/components/ui/search-field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const COMMON_NAMES = [
  'Pantalla', 'Batería', 'Flex de carga', 'Placa base', 'Cámara',
  'Altavoz', 'Micrófono', 'Tapa trasera', 'Cargador', 'Cable',
];
const searchKey = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

const combineNames = (...groups) => {
  const choices = new Map();
  groups.flat().forEach((value) => {
    const name = typeof value === 'string' ? value.trim() : '';
    if (name && !choices.has(searchKey(name))) choices.set(searchKey(name), name);
  });
  return Array.from(choices.values());
};

const InventoryNameSelector = ({ value, onChange, existingNames = [] }) => {
  const { getAuthHeader } = useAuth();
  const [savedNames, setSavedNames] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const recordedName = useRef('');

  useEffect(() => {
    let active = true;
    axios.get(`${API}/api/inventory/names`, { headers: getAuthHeader() })
      .then(({ data }) => { if (active && Array.isArray(data.names)) setSavedNames(data.names); })
      .catch(() => {});
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const names = combineNames(COMMON_NAMES, existingNames, savedNames);
  const visible = names.filter((name) => searchKey(name).includes(searchKey(search.trim())));

  const saveName = (rawName) => {
    const name = rawName.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!name || searchKey(name) === searchKey(recordedName.current)) return;
    recordedName.current = name;
    setSavedNames((current) => combineNames(current, [name]));
    onChange(name);
    axios.post(`${API}/api/inventory/names`, { name }, { headers: getAuthHeader() })
      .catch(() => toast.error('No se pudo guardar el artículo en la lista. El nombre sigue en el formulario.'));
  };

  const chooseName = (name) => {
    setOpen(false);
    setSearch('');
    setManualMode(false);
    recordedName.current = name;
    onChange(name);
  };

  const addOther = () => {
    const typed = search.trim();
    setOpen(false);
    setSearch('');
    if (typed) {
      setManualMode(false);
      saveName(typed);
    } else {
      recordedName.current = '';
      onChange('');
      setManualMode(true);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="inventory-name-select" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Nombre del artículo</Label>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
        <PopoverTrigger asChild>
          <Button id="inventory-name-select" type="button" variant="outline" role="combobox"
            aria-expanded={open} aria-label="Seleccionar o buscar artículo"
            className="h-11 w-full justify-between border-zinc-200 px-3 font-normal text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            data-testid="item-name-select">
            <span className="min-w-0 truncate">{value || 'Seleccionar o escribir un artículo'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-zinc-200 p-0 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
            <SearchField autoFocus placeholder="Buscar artículo..." value={search}
              onChange={(event) => setSearch(event.target.value)} maxLength={120} data-testid="item-name-search" />
          </div>
          <div role="listbox" aria-label="Artículos" className="max-h-64 overflow-y-auto p-1">
            {visible.length === 0 && <p className="px-3 py-3 text-sm text-zinc-500">No hay artículos con ese nombre.</p>}
            {visible.map((name) => <button key={name} type="button" role="option" aria-selected={value === name}
              onClick={() => chooseName(name)}
              className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 focus:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
              data-testid={`item-name-option-${name}`}>
              <span className="min-w-0 flex-1 break-words">{name}</span>
              {value === name && <Check className="h-4 w-4 text-blue-600" />}
            </button>)}
          </div>
          <button type="button" onClick={addOther}
            className="flex min-h-10 w-full items-center gap-2 border-t border-zinc-200 px-4 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 focus:bg-blue-50 dark:border-zinc-700 dark:text-blue-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
            data-testid="item-name-other-option">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{search.trim() ? `Agregar «${search.trim()}» a la lista` : 'Escribir otro artículo'}</span>
          </button>
        </PopoverContent>
      </Popover>
      {manualMode && <Input id="inventory-name-manual" value={value} maxLength={120} autoFocus
        onChange={(event) => { recordedName.current = ''; onChange(event.target.value); }}
        onBlur={() => saveName(value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
        placeholder="Escribe el nombre del artículo" className="dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        data-testid="item-name-input" />}
    </div>
  );
};

export default InventoryNameSelector;

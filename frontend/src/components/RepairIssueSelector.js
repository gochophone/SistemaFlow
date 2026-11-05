import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchField } from '@/components/ui/search-field';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const COMMON_ISSUES = [
  'No enciende', 'Corto', 'Cámara', 'Pantalla', 'Micrófono',
  'Audio', 'Face ID', 'Señal', 'Batería', 'Flex carga',
];

const mergeOptions = (current, incoming) => {
  const custom = new Map();
  [...current, ...incoming].forEach((issue) => {
    if (typeof issue === 'string' && issue && !COMMON_ISSUES.includes(issue)) {
      custom.set(issue.toLocaleLowerCase('es'), issue);
    }
  });
  return [...COMMON_ISSUES, ...Array.from(custom.values()).sort((a, b) => a.localeCompare(b, 'es'))];
};

const searchableText = (text) => text.normalize('NFD')
  .replace(/[\u0300-\u036f\s]+/g, '')
  .toLocaleLowerCase('es');

const RepairIssueSelector = ({ value, onChange, idPrefix = 'reported-issue', label = 'Falla reportada *', showFrequent = true }) => {
  const { getAuthHeader } = useAuth();
  const [options, setOptions] = useState(COMMON_ISSUES);
  const [frequent, setFrequent] = useState([]);
  const [manualMode, setManualMode] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedRef = useRef(false);
  const pendingRequestsRef = useRef(0);
  const postQueueRef = useRef(Promise.resolve());
  const recordedManualRef = useRef(null);

  useEffect(() => {
    let active = true;
    axios.get(`${API}/api/repairs/issues`, { headers: getAuthHeader() })
      .then(({ data }) => {
        if (!active) return;
        if (Array.isArray(data.options)) setOptions((current) => mergeOptions(current, data.options));
        if (selectedRef.current) return;
        setFrequent(Array.isArray(data.frequent) ? data.frequent.slice(0, 5) : []);
      })
      .catch(() => {
        // Las opciones comunes siguen disponibles si falla la carga del catálogo.
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordIssue = (issue, manuallyAdded = false) => {
    const name = issue.trim();
    if (!name) return;
    selectedRef.current = true;
    pendingRequestsRef.current += 1;
    setFrequent((current) => {
      const choices = current.map((item) => ({ ...item }));
      const existing = choices.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing) existing.count += 1;
      else choices.push({ name, count: 1 });
      return choices.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5);
    });
    postQueueRef.current = postQueueRef.current
      .then(() => axios.post(`${API}/api/repairs/issues`, { name }, { headers: getAuthHeader() }))
      .then(({ data }) => {
        pendingRequestsRef.current -= 1;
        if (Array.isArray(data.options)) {
          setOptions((current) => mergeOptions(current, data.options));
        }
        if (pendingRequestsRef.current === 0 && Array.isArray(data.frequent)) {
          setFrequent(data.frequent.slice(0, 5));
        }
      })
      .catch(() => {
        pendingRequestsRef.current -= 1;
        if (manuallyAdded) toast.error('No se pudo guardar la falla en la lista. Intenta nuevamente.');
      });
  };

  const chooseIssue = (issue) => {
    setListOpen(false);
    setSearch('');
    setManualMode(false);
    onChange(issue);
    recordIssue(issue);
  };

  const chooseManualIssue = () => {
    const typed = search.trim().slice(0, 120);
    setListOpen(false);
    setSearch('');
    setManualMode(true);
    recordedManualRef.current = null;
    onChange(typed);
  };

  const recordManualIssue = () => {
    const name = value.trim();
    if (name && name !== recordedManualRef.current) {
      recordedManualRef.current = name;
      onChange(name);
      recordIssue(name, true);
    }
  };

  const visibleOptions = options.filter((issue) => searchableText(issue).includes(searchableText(search.trim())));

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-select`} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</Label>
      <Popover open={listOpen} onOpenChange={(open) => {
        setListOpen(open);
        if (!open) setSearch('');
      }}>
        <PopoverTrigger asChild>
          <Button
            id={`${idPrefix}-select`}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={`${idPrefix}-options`}
            aria-label={label === 'Falla reportada *' ? 'Seleccionar o buscar falla' : `Seleccionar o buscar ${label.toLowerCase()}`}
            className="h-11 w-full justify-between border-zinc-200 px-3 font-normal text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            data-testid={`${idPrefix}-select`}
          >
            <span className="min-w-0 truncate text-left">{value || 'Seleccionar o buscar falla'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-zinc-200 p-0 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="relative border-b border-zinc-200 p-2 dark:border-zinc-700">
            <SearchField
              autoFocus
              placeholder="Buscar falla..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={120}
              data-testid={`${idPrefix}-search`}
            />
          </div>
          <div id={`${idPrefix}-options`} role="listbox" aria-label="Fallas reportadas" className="max-h-72 overflow-y-auto p-1" data-testid={`${idPrefix}-options`}>
            {visibleOptions.length === 0 && (
              <p className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">No hay fallas con ese nombre.</p>
            )}
            {visibleOptions.map((issue) => (
              <button
                key={issue}
                type="button"
                role="option"
                aria-selected={!manualMode && value === issue}
                onClick={() => chooseIssue(issue)}
                className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                data-testid={idPrefix === 'reported-issue' ? `issue-option-${issue}` : `${idPrefix}-option-${issue}`}
              >
                <span className="min-w-0 flex-1 break-words">{issue}</span>
                {!manualMode && value === issue && <Check className="h-4 w-4 text-blue-600 dark:text-blue-300" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={chooseManualIssue}
            className="flex min-h-10 w-full items-center gap-2 border-t border-zinc-200 px-4 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none dark:border-zinc-700 dark:text-blue-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
            data-testid={idPrefix === 'reported-issue' ? 'issue-other-option' : `${idPrefix}-other-option`}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{search.trim() ? `Escribir «${search.trim()}» como nueva falla` : 'Escribir otra falla'}</span>
          </button>
        </PopoverContent>
      </Popover>

      {manualMode && (
        <Input
          id={`${idPrefix}-manual`}
          value={value}
          onChange={(event) => {
            recordedManualRef.current = null;
            onChange(event.target.value);
          }}
          onBlur={recordManualIssue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          maxLength={120}
          required
          autoFocus
          placeholder="Escribe la falla; se guardará al salir del campo"
          className="border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          data-testid={`${idPrefix}-input`}
        />
      )}

      {showFrequent && frequent.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2" data-testid={idPrefix === 'reported-issue' ? 'frequent-issues' : `${idPrefix}-frequent-issues`}>
          {frequent.map(({ name }) => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={value === name}
              onClick={() => chooseIssue(name)}
              className={value === name
                ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200'
                : 'dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800'}
              data-testid={idPrefix === 'reported-issue' ? `frequent-issue-${name}` : `${idPrefix}-frequent-issue-${name}`}
            >
              {name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RepairIssueSelector;

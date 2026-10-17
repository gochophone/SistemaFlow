import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const OTHER_ISSUE = '__other_issue__';
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

const RepairIssueSelector = ({ value, onChange }) => {
  const { getAuthHeader } = useAuth();
  const [options, setOptions] = useState(COMMON_ISSUES);
  const [frequent, setFrequent] = useState([]);
  const [manualMode, setManualMode] = useState(false);
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
    if (issue === OTHER_ISSUE) {
      setManualMode(true);
      recordedManualRef.current = null;
      onChange('');
      return;
    }
    setManualMode(false);
    onChange(issue);
    recordIssue(issue);
  };

  const recordManualIssue = () => {
    const name = value.trim();
    if (name && name !== recordedManualRef.current) {
      recordedManualRef.current = name;
      onChange(name);
      recordIssue(name, true);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="reported_issue" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Falla reportada *</Label>
      <Select value={manualMode ? OTHER_ISSUE : options.includes(value) ? value : ''} onValueChange={chooseIssue}>
        <SelectTrigger id="reported_issue" className="border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" data-testid="reported-issue-select">
          <SelectValue placeholder="Seleccionar falla" />
        </SelectTrigger>
        <SelectContent>
          {options.map((issue) => <SelectItem key={issue} value={issue}>{issue}</SelectItem>)}
          <SelectItem value={OTHER_ISSUE}>Especificar otra falla…</SelectItem>
        </SelectContent>
      </Select>

      {manualMode && (
        <Input
          id="reported_issue_manual"
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
          data-testid="reported-issue-input"
        />
      )}

      {frequent.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2" data-testid="frequent-issues">
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
              data-testid={`frequent-issue-${name}`}
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

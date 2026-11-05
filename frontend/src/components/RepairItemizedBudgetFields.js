import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import RepairIssueSelector from '@/components/RepairIssueSelector';
import { formatCLP } from '@/utils/currency';
import { budgetBreakdown, grossFromNet, parseBudgetInput } from '@/utils/repairBudget';
import { budgetItemsTotal, MAX_REPAIR_BUDGET_ITEMS } from '@/utils/repairBudgetItems';
import { Plus, Trash2 } from 'lucide-react';

const numberFormat = new Intl.NumberFormat('es-CL');

const RepairItemizedBudgetFields = ({ idPrefix, primaryIssue, items, vatIncluded, onChange }) => {
  const rows = items || [];
  const hasValues = rows.some((item) => item.amount !== '' && item.amount !== null && item.amount !== undefined);
  const total = budgetItemsTotal(rows);
  const breakdown = hasValues ? budgetBreakdown(total, vatIncluded) : null;

  const changeItems = (nextItems) => onChange({ items: nextItems, vatIncluded });
  const changeItem = (index, patch) => changeItems(rows.map((item, row) => row === index ? { ...item, ...patch } : item));
  const changeNet = (event) => {
    const net = parseBudgetInput(event.target.value);
    changeItem(0, { amount: net === null ? '' : grossFromNet(net) });
  };

  return (
    <div className="space-y-4" data-testid={`${idPrefix}-itemized-budget`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Valor por falla</h3>
        <Button type="button" variant="outline" size="sm"
          onClick={() => changeItems([...rows, { issue: '', amount: '', draftId: Math.random().toString(36).slice(2) }])}
          disabled={!primaryIssue?.trim() || rows.length >= MAX_REPAIR_BUDGET_ITEMS}
          data-testid={`${idPrefix}-add-budget-item`}>
          <Plus size={15} className="mr-1" /> Agregar falla
        </Button>
      </div>

      {rows.map((item, index) => (
        <div key={index === 0 ? 'primary' : item.draftId} className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end"
          data-testid={`${idPrefix}-budget-item-${index}`}>
          {index === 0 ? (
            <div>
              <Label className="text-sm text-zinc-900 dark:text-zinc-100">Falla reportada</Label>
              <p className="mt-1 flex min-h-10 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                {item.issue?.trim() || primaryIssue?.trim() || 'Selecciona la falla arriba'}
              </p>
            </div>
          ) : (
            <RepairIssueSelector idPrefix={`${idPrefix}-issue-${index}`} label="Falla adicional"
              value={item.issue} onChange={(issue) => changeItem(index, { issue })} />
          )}
          <div>
            <Label htmlFor={`${idPrefix}-amount-${index}`} className="text-sm text-zinc-900 dark:text-zinc-100">Valor (CLP)</Label>
            <Input id={`${idPrefix}-amount-${index}`} inputMode="numeric" className="mt-1 dark:bg-zinc-900 dark:text-zinc-100"
              value={item.amount === '' || item.amount === null || item.amount === undefined ? '' : numberFormat.format(item.amount)}
              onChange={(event) => changeItem(index, { amount: parseBudgetInput(event.target.value) ?? '' })}
              placeholder="0" data-testid={`${idPrefix}-amount-${index}`} />
          </div>
          {index > 0 ? (
            <Button type="button" variant="ghost" size="icon" aria-label={`Quitar falla ${index + 1}`}
              onClick={() => changeItems(rows.filter((_, row) => row !== index))}
              data-testid={`${idPrefix}-remove-budget-item-${index}`}>
              <Trash2 size={16} />
            </Button>
          ) : <span className="hidden w-10 sm:block" />}
        </div>
      ))}

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <Switch id={`${idPrefix}-vat`} checked={vatIncluded}
            onCheckedChange={(checked) => onChange({ items: rows, vatIncluded: checked })}
            data-testid={`${idPrefix}-vat-switch`} />
          <Label htmlFor={`${idPrefix}-vat`} className="text-sm text-zinc-900 dark:text-zinc-100">Aplicar IVA (19%)</Label>
        </div>
        {vatIncluded && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${idPrefix}-net`} className="text-sm text-zinc-900 dark:text-zinc-100">Valor neto (CLP)</Label>
              <Input id={`${idPrefix}-net`} className="mt-1 dark:bg-zinc-950 dark:text-zinc-100" inputMode="numeric"
                value={breakdown ? numberFormat.format(breakdown.net) : ''}
                onChange={rows.length === 1 ? changeNet : undefined}
                readOnly={rows.length !== 1}
                data-testid={`${idPrefix}-net-input`} />
              {rows.length > 1 && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Modifica los valores de las fallas para cambiar el neto.</p>}
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">IVA (19%)</p>
              <p className="text-lg font-semibold text-blue-950 dark:text-blue-100" data-testid={`${idPrefix}-vat-amount`}>
                {breakdown ? formatCLP(breakdown.vat) : '—'}
              </p>
            </div>
          </div>
        )}
        <p className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-base font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          <span>Valor total{vatIncluded ? ' con IVA' : ''}</span>
          <span data-testid={`${idPrefix}-budget-total`}>{breakdown ? formatCLP(breakdown.total) : '—'}</span>
        </p>
      </div>
    </div>
  );
};

export default RepairItemizedBudgetFields;

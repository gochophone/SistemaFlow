import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PaymentConfirmationDialog = ({ change, onCancel, onConfirm }) => {
  const device = [change?.repair?.device_brand, change?.repair?.device_model].filter(Boolean).join(' ');

  return (
    <AlertDialog open={Boolean(change)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      {change && (
        <AlertDialogContent className="border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" data-testid="payment-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{change.paid ? '¿Confirmar pago recibido?' : '¿Marcar pago como pendiente?'}</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-zinc-400">
              {change.paid
                ? `La orden ${change.ticketNumber} quedará como pagada y se registrará la fecha del pago.`
                : `La orden ${change.ticketNumber} volverá a pendiente y se quitará la fecha de pago registrada.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Cliente</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100" data-testid="payment-confirmation-customer">{change.repair?.customer_name || 'No registrado'}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Equipo / modelo</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100" data-testid="payment-confirmation-device">{device || 'No registrado'}</dd>
            </div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-payment-change">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} data-testid="confirm-payment-change">
              {change.paid ? 'Sí, marcar pagada' : 'Sí, marcar pendiente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
};

export default PaymentConfirmationDialog;

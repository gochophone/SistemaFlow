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

const PaymentConfirmationDialog = ({ change, onCancel, onConfirm }) => (
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

export default PaymentConfirmationDialog;

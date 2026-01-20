import { observer } from 'mobx-react-lite';
import { useStore } from '../store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';

export const ToastContainer = observer(() => {
  const { toastStore } = useStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toastStore.toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border animate-in slide-in-from-right fade-in duration-300",
            "bg-white dark:bg-gray-800",
            toast.type === 'success' && "border-emerald-200 dark:border-emerald-900",
            toast.type === 'error' && "border-red-200 dark:border-red-900",
            toast.type === 'warning' && "border-amber-200 dark:border-amber-900",
            toast.type === 'info' && "border-blue-200 dark:border-blue-900"
          )}
        >
          <div className="flex items-start gap-3">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
            
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => toastStore.remove(toast.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export const searchInputClasses = 'h-9 w-full rounded-md border border-zinc-200 bg-white py-1 pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400';

const SearchField = React.forwardRef(({ className, inputClassName, ...props }, ref) => (
  <div className={cn('relative', className)}>
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
    <Input ref={ref} className={cn(searchInputClasses, inputClassName)} {...props} />
  </div>
));

SearchField.displayName = 'SearchField';

export { SearchField };

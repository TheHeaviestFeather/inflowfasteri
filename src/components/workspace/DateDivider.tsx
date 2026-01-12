import { cn } from "@/lib/utils";

interface DateDividerProps {
  label: string;
  className?: string;
}

export function DateDivider({ label, className }: DateDividerProps) {
  return (
    <div className={cn("relative my-8", className)}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-4 text-sm text-slate-500 font-medium">
          {label}
        </span>
      </div>
    </div>
  );
}

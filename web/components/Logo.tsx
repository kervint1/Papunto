export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 shadow-sm">
        <span className="text-xl">💰</span>
      </div>
      <span className="text-xl tracking-tight text-neutral-900">Papunto</span>
    </div>
  );
}

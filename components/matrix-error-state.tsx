export function MatrixErrorState({
  title,
  message,
  details
}: {
  title: string;
  message: string;
  details?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-panel max-w-3xl rounded-[2rem] border border-slate-800 bg-slate-950/70 p-10">
        <p className="text-xs uppercase tracking-[0.4em] text-rose-400">Matrix Bootstrap Error</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-4 text-base text-slate-300">{message}</p>
        {details ? (
          <pre className="mt-6 overflow-x-auto rounded-[1.5rem] border border-slate-800 bg-[#01050d] p-4 text-sm text-slate-400">
            {details}
          </pre>
        ) : null}
      </div>
    </main>
  );
}

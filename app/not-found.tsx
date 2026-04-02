import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass-panel max-w-xl rounded-[2rem] p-10 text-center">
        <p className="text-sm uppercase tracking-[0.32em] text-sky-400">Restricted</p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-slate-50">
          This admin workspace is not available for your account.
        </h1>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Access requires a profile with <code>is_superadmin</code> or <code>is_matrix_admin</code>.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full border border-sky-400/25 bg-sky-500/15 px-5 py-3 text-sm font-medium text-sky-700 dark:text-sky-100"
        >
          Return Home
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass-panel max-w-2xl rounded-[2rem] p-10 text-center">
        <p className="text-sm uppercase tracking-[0.32em] text-sky-400">
          Humor Flavors
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-50 dark:text-slate-50">
          Admin management workspace for prompt-chain flavors.
        </h1>
        <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
          Use the guarded editor to manage sequential chain steps, images, and API test runs.
        </p>
        <Link
          href="/admin/flavors"
          className="mt-8 inline-flex rounded-full border border-sky-400/40 bg-sky-500/15 px-6 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-500/25 dark:text-sky-100"
        >
          Open Flavor Editor
        </Link>
      </div>
    </main>
  );
}

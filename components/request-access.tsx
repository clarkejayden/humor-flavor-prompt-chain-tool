import Link from "next/link";

export function RequestAccess() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-panel max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950/60 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">Access Denied</p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-100">
          The Matrix is restricted to super admins.
        </h1>
        <p className="mt-4 text-base text-slate-400">
          Access requires <code>profiles.is_superadmin</code> to be <code>true</code>.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="https://slack.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-5 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
          >
            Request Access in Slack
          </a>
          <Link
            href="/"
            className="inline-flex rounded-full border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function Landing() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold tracking-tight">Eventicool</span>
        <a href="/login" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Sign in
        </a>
      </header>
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-32 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Beautiful event websites, in minutes
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
          Upload your pictures, pick a template, preview your site, and share your day with everyone who matters.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <a href="/login" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
            Get started
          </a>
          <a href="/guest" className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold hover:bg-slate-50">
            I have an event code
          </a>
        </div>
      </section>
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        &copy; 2026 Eventicool
      </footer>
    </main>
  )
}

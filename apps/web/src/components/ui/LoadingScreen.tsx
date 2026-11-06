export function LoadingScreen() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f1ea] px-5 text-[#161512]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#d8d1c5] sm:-right-12 sm:-top-28 sm:h-96 sm:w-96"
      />
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-[#d8d1c5] sm:right-4 sm:top-0 sm:h-64 sm:w-64"
      />

      <section
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="relative w-full max-w-md border border-[#161512] bg-[#f8f5ee] p-7 shadow-[8px_8px_0_#ded8cc] sm:p-10"
      >
        <div className="flex items-center justify-between border-b border-[#c9c3b6] pb-5">
          <div>
            <p className="font-serif text-2xl leading-none tracking-tight">Annex C</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5b574e]">
              CAR management system
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center border border-[#c9c3b6] font-serif text-2xl text-[#7a1f1f]"
          >
            C
          </span>
        </div>

        <div className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7a1f1f]">
            One moment
          </p>
          <h1 className="mt-2 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Preparing your workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5b574e]">
            We’re getting everything ready. This should only take a moment.
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Preparing your workspace"
          className="loading-progress mt-8 h-1 overflow-hidden bg-[#e6e0d5]"
        >
          <div aria-hidden="true" className="loading-progress__indicator h-full bg-[#7a1f1f]" />
        </div>
      </section>
    </main>
  );
}

export function ImportsUnavailablePage() {
  return (
    <section
      role="status"
      className="max-w-[680px] border-l-4 border-[#8a5a00] border-y border-r border-[#8a5a00] bg-[#f3ead8] px-4 py-4"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#704700]">
        Temporarily unavailable
      </p>
      <h1 className="mt-2 font-serif text-3xl">Excel imports are paused</h1>
      <p className="mt-3 text-sm leading-6 text-[#3f3b34]">
        Importing is temporarily disabled while the system is updated to protect sensitive
        household data. Existing household and CAR records remain available in their respective
        sections.
      </p>
    </section>
  );
}

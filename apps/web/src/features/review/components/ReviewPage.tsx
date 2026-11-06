export function ReviewPage() {
  return (
    <section
      role="status"
      className="max-w-[680px] border-l-4 border-[#8a5a00] border-y border-r border-[#8a5a00] bg-[#f3ead8] px-4 py-4"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#704700]">
        Temporarily unavailable
      </p>
      <h1 className="mt-2 font-serif text-3xl">CAR review is paused</h1>
      <p className="mt-3 text-sm leading-6 text-[#3f3b34]">
        Review decisions are unavailable until they can be stored and audited by the server.
        No sample submissions or simulated approvals are shown.
      </p>
    </section>
  );
}

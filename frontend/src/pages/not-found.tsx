export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[hsl(var(--background))] p-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-extrabold">Page not found</h1>
        <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
          Page not found.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]"
        >
          Back to arena
        </a>
      </div>
    </div>
  );
}

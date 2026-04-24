import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import PinScreenWrapper from "./(dashboard)/PinScreenWrapper";
import { resolveServerAccess } from "@/lib/auth";

export default async function LandingPage() {
  const { access, subdomain } = await resolveServerAccess({
    allowTrustedDevice: true,
  });

  if (subdomain) {
    if (access) {
      redirect("/files");
    }

    return (
      <main className="min-h-screen bg-background">
        <PinScreenWrapper subdomain={subdomain} />
      </main>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="motion-ambient absolute left-[-7rem] top-16 h-72 w-72 rounded-full bg-blue-500/14 blur-3xl" />
        <div className="motion-ambient-slow absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </div>

      <header className="relative z-50 mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6 motion-enter lg:px-8">
        <div className="font-[800] text-2xl tracking-widest uppercase">
          oneflash
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="font-medium text-muted-foreground motion-nav-item hover:text-foreground">
            Login
          </Link>
          <Link href="/register" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-bold tracking-wide text-background motion-hover-lift motion-press hover:opacity-90">
            Get Started
          </Link>
        </div>
      </header>

      <main className="relative z-10 -mt-20 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-blue-500 motion-enter motion-enter-delay-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          The future of cloud storage
        </div>
        
        <h1 className="mb-8 max-w-5xl font-outfit text-5xl font-[800] leading-tight tracking-tight motion-enter motion-enter-delay-2 md:text-7xl lg:text-8xl">
          Your cloud drives.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-300">
            One physical feel.
          </span>
        </h1>
        
        <p className="mb-12 max-w-2xl text-xl font-medium text-muted-foreground motion-enter motion-enter-delay-3">
          Connect Google Drive and OneDrive. Access them from your personal PIN-protected subdomain with a beautiful interface.
        </p>

        <div className="flex flex-col items-center gap-4 motion-enter motion-enter-delay-4 sm:flex-row">
          <Link href="/register" className="group flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-[0_0_40px_rgba(37,99,235,0.35)] motion-hover-lift motion-press hover:bg-blue-500">
            Claim Your Subdomain
            <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </main>

      <footer className="relative z-10 py-8 text-center text-sm font-medium text-muted motion-enter motion-enter-delay-4">
        © {new Date().getFullYear()} oneflash.one. Designed for the modern web.
      </footer>
    </div>
  );
}

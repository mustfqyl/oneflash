import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <header className="h-20 w-full max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-8">
        <div className="font-[800] text-2xl tracking-widest uppercase">
          oneflash
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-zinc-400 font-medium hover:text-white transition-colors">
            Login
          </Link>
          <Link href="/register" className="bg-white text-black px-5 py-2.5 rounded-full font-bold text-sm tracking-wide hover:bg-zinc-200 transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 -mt-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-sm font-medium text-blue-400 mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          The future of cloud storage
        </div>
        
        <h1 className="font-outfit text-5xl md:text-7xl lg:text-8xl font-[800] tracking-tight max-w-5xl leading-tight mb-8">
          Your cloud drives.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-300">
            One physical feel.
          </span>
        </h1>
        
        <p className="text-xl text-zinc-400 max-w-2xl mb-12 font-medium">
          Connect Google Drive, OneDrive, and iCloud. Access them all from your personal PIN-protected subdomain with a beautiful interface.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/register" className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(37,99,235,0.4)]">
            Claim Your Subdomain
            <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </main>

      <footer className="py-8 text-center text-zinc-600 text-sm font-medium">
        © {new Date().getFullYear()} oneflash.co. Designed for the modern web.
      </footer>
    </div>
  );
}

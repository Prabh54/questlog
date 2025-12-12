import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Zap } from 'lucide-react';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Auto-close on route change
  useEffect(() => setOpen(false), [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-surface-950">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* Mobile backdrop */}
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-surface-800 bg-surface-950/95 backdrop-blur px-4 py-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="text-surface-300 hover:text-surface-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-500" />
            <span className="font-bold text-surface-50">QuestLog</span>
          </div>
        </header>

        <main>
          <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

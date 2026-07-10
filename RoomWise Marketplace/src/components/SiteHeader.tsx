import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isAuthenticated, logout, getUsername } from "@/lib/auth";

export function SiteHeader() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const sync = () => {
      setAuthed(isAuthenticated());
      setUser(getUsername());
    };
    sync();
    window.addEventListener("mr-auth-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mr-auth-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <header className="border-b border-border/70 bg-background/85 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 group">
          <span className="inline-flex h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground items-center justify-center font-serif text-lg">
            M
          </span>
          <span className="font-serif text-lg sm:text-xl tracking-tight text-foreground truncate">
            Marketplace Rooms
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-5 text-sm">
          <Link
            to="/listings"
            className="hidden sm:inline-flex text-foreground/80 hover:text-primary [&.active]:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Browse rooms
          </Link>
          <Link
            to="/categories"
            className="hidden sm:inline-flex text-foreground/80 hover:text-primary [&.active]:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Room types
          </Link>
          {authed ? (
            <>
              <Link
                to="/dashboard"
                className="text-foreground/80 hover:text-primary [&.active]:text-primary transition-colors"
              >
                Dashboard
              </Link>
              <span className="text-xs text-muted-foreground hidden lg:inline">{user}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  router.navigate({ to: "/" });
                }}
              >
                Sign out
              </Button>
              <Link to="/dashboard/listings/new" className="hidden sm:inline-flex">
                <Button size="sm">List your room</Button>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Owner sign in
              </Link>
              <Link to="/listings" className="sm:hidden">
                <Button size="sm">Browse</Button>
              </Link>
              <Link to="/login" className="hidden sm:inline-flex">
                <Button size="sm" variant="outline">
                  List your room
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 mt-20 bg-card/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-8 sm:grid-cols-3 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 rounded-full bg-primary text-primary-foreground items-center justify-center font-serif">
              M
            </span>
            <span className="font-serif text-lg text-foreground">Marketplace Rooms</span>
          </div>
          <p className="text-muted-foreground max-w-xs">
            Rooms to rent across South Africa. Enquire directly with owners.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Explore</div>
          <ul className="space-y-1.5">
            <li>
              <Link to="/listings" className="hover:text-primary">
                Browse rooms
              </Link>
            </li>
            <li>
              <Link to="/categories" className="hover:text-primary">
                Room types
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">For owners</div>
          <ul className="space-y-1.5">
            <li>
              <Link to="/login" className="hover:text-primary">
                Owner sign in
              </Link>
            </li>
            <li>
              <Link to="/dashboard/listings/new" className="hover:text-primary">
                List your room
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Marketplace Rooms
        </div>
      </div>
    </footer>
  );
}

import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "@clerk/tanstack-react-start";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { roleFromClaims } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  component: DashboardLayout,
});

function DashboardLayout() {
  const router = useRouter();
  const { isLoaded, isSignedIn, sessionClaims } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.navigate({ to: "/login" });
    } else if (roleFromClaims(sessionClaims) !== "admin") {
      router.navigate({ to: "/listings" });
    } else {
      setReady(true);
    }
  }, [isLoaded, isSignedIn, router, sessionClaims]);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Checking your session…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        <nav className="flex flex-wrap gap-4 border-b border-border pb-3 mb-8 text-sm">
          <DashLink to="/dashboard">Overview</DashLink>
          <DashLink to="/dashboard/listings">My listings</DashLink>
          <DashLink to="/dashboard/listings/new">New listing</DashLink>
        </nav>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

function DashLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/dashboard" }}
      className="text-muted-foreground hover:text-primary [&.active]:text-primary [&.active]:font-medium"
    >
      {children}
    </Link>
  );
}

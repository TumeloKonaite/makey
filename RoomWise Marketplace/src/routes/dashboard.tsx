import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  component: DashboardLayout,
});

function DashboardLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isAuthenticated()) {
      router.navigate({ to: "/login" });
    } else {
      setReady(true);
    }
  }, [router]);

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
          <DashLink to="/dashboard/enquiries">Enquiries</DashLink>
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

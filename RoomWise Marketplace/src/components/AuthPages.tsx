import { SignIn, SignUp } from "@clerk/tanstack-react-start";

import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

function AuthPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-16">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function LoginPage() {
  return (
    <AuthPageLayout>
      <SignIn routing="path" path="/login" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </AuthPageLayout>
  );
}

export function SignUpPage() {
  return (
    <AuthPageLayout>
      <SignUp routing="path" path="/sign-up" signInUrl="/login" fallbackRedirectUrl="/" />
    </AuthPageLayout>
  );
}

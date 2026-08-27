import { createFileRoute } from "@tanstack/react-router";

import { SignUpPage } from "@/components/AuthPages";

export const Route = createFileRoute("/sign-up/$")({
  ssr: false,
  component: SignUpPage,
});

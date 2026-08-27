import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "@/components/AuthPages";

export const Route = createFileRoute("/login/$")({
  ssr: false,
  component: LoginPage,
});

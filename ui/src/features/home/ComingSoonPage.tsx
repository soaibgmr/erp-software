import { useLocation, useNavigate } from "react-router";
import { Compass } from "lucide-react";
import { ALL_NAV_ITEMS } from "@/app/nav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Controls";
import { EmptyState } from "@/components/ui/States";

// Placeholder for sidebar modules scheduled in later phases (docs/DEVELOPMENT_PLAN.md).
export function ComingSoonPage() {
  const { pathname } = useLocation();
  const item = ALL_NAV_ITEMS.find((i) => i.to !== "/" && pathname.startsWith(i.to));
  if (!item) return <NotFoundPage />;
  return (
    <>
      <PageHeader title={item.label} />
      <Card>
        <EmptyState
          icon={item.icon}
          title={`${item.label} arrives in Phase ${item.phase}`}
          description={item.description}
        />
      </Card>
    </>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="This page doesn't exist"
        description="The link may be old, or the page moved."
        action={<Button onClick={() => navigate("/")}>Go to dashboard</Button>}
      />
    </Card>
  );
}

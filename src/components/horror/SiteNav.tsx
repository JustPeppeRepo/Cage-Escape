import { SiteNavClient } from "@/components/horror/SiteNavClient";

export type SiteNavUser = {
  name: string;
  email: string;
  isAdmin: boolean;
};

type SiteNavProps = {
  user: SiteNavUser | null;
};

export function SiteNav({ user }: SiteNavProps) {
  return <SiteNavClient user={user} />;
}

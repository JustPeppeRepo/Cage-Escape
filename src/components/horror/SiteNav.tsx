import { SiteNavClient } from "@/components/horror/SiteNavClient";

export type SiteNavUser = {
  name: string;
  username: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

type SiteNavProps = {
  user: SiteNavUser | null;
};

export function SiteNav({ user }: SiteNavProps) {
  return <SiteNavClient user={user} />;
}

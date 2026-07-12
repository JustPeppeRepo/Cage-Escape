import { SiteNavAuth } from "@/components/horror/SiteNavAuth";

export type SiteNavUser = {
  name: string;
  username: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

export function SiteNav() {
  return <SiteNavAuth />;
}

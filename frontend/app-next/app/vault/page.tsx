import type { Metadata } from "next";

import { VaultPage } from "@/components/vault/vault-page";
import { loadVaultPageModel } from "@/lib/loaders/vault";
import { readCurrentUserCookieFromRequest } from "@/lib/utils/request-context";

export const metadata: Metadata = {
  title: "StaReplays Replay Vault",
  description: "Review recent games, open match details, and explore replay metadata."
};

type ReplayVaultPageProps = {
  searchParams?: {
    currentUser?: string | string[];
  };
};

export default async function ReplayVaultPage(props: ReplayVaultPageProps) {
  const searchParams = props?.searchParams;
  const currentUser = typeof searchParams?.currentUser === "string" ? searchParams.currentUser.trim() : Array.isArray(searchParams?.currentUser) ? searchParams.currentUser[0]?.trim() : undefined;
  const currentUserCookie = readCurrentUserCookieFromRequest();
  const model = await loadVaultPageModel({ currentUser, currentUserCookie });

  return <VaultPage model={model} />;
}

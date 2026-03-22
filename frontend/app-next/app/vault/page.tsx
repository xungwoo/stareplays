import type { Metadata } from "next";

import { VaultPage } from "@/components/vault/vault-page";
import { loadVaultPageModel } from "@/lib/loaders/vault";

export const metadata: Metadata = {
  title: "StaReplays Replay Vault",
  description: "Review recent games, open match details, and explore replay metadata."
};

export default async function ReplayVaultPage() {
  const model = await loadVaultPageModel();

  return <VaultPage model={model} />;
}

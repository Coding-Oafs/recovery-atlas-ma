import { getResources } from "@/lib/db";
import Directory from "@/components/directory";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { resources, mode } = await getResources();
  return <Directory resources={resources} mode={mode} />;
}

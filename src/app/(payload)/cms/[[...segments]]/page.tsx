import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";
import { redirect } from "next/navigation";
import { isPreviewMode } from "@/lib/deployment";
import { importMap } from "../importMap";
type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};
export const generateMetadata = (args: Args) =>
  isPreviewMode()
    ? { title: "Pikol Content", robots: { index: false, follow: false } }
    : generatePageMetadata({ ...args, config });
export default function Page(args: Args) {
  if (isPreviewMode()) redirect("/login?next=/cms");
  return RootPage({ ...args, config, importMap });
}

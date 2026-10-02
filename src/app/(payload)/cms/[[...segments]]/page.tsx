import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap";
type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};
export const generateMetadata = (args: Args) =>
  generatePageMetadata({ ...args, config });
export default function Page(args: Args) {
  return RootPage({ ...args, config, importMap });
}

import config from "@payload-config";
import { NotFoundPage } from "@payloadcms/next/views";
import { redirect } from "next/navigation";
import { isPreviewMode } from "@/lib/deployment";
import { importMap } from "../importMap";
export default function NotFound() {
  if (isPreviewMode()) redirect("/login?next=/cms");
  return NotFoundPage({
    config,
    importMap,
    params: Promise.resolve({ segments: [] }),
    searchParams: Promise.resolve({}),
  });
}

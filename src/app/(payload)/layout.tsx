import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import type { ServerFunctionClient } from "payload";
import config from "@payload-config";
import { resolveCmsAdmin } from "@/cms/auth";
import { getSession } from "@/lib/auth/session";
import { importMap } from "./cms/importMap";
import "@payloadcms/next/css";
import "./custom.css";

const serverFunction: ServerFunctionClient = async (args) => {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await resolveCmsAdmin(await headers());
  if (!admin) {
    if (await getSession()) redirect("/");
    redirect("/login?next=/cms");
  }
  return (
    <RootLayout
      config={config}
      importMap={importMap}
      serverFunction={serverFunction}
    >
      {children}
    </RootLayout>
  );
}

import type { Field, GlobalConfig, TextField } from "payload";
import { canManageContent } from "./access";
import { homeDefaults, siteDefaults, venueLandingDefaults } from "./defaults";

const link: TextField = {
  name: "href",
  type: "text",
  required: true,
  validate: (value: unknown) => {
    if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value))
      return "Use a local path, anchor, or HTTPS URL.";
    if (value.startsWith("#") && value.length > 1) return true;
    if (
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !/^\/%(2f|5c)/i.test(value)
    )
      return true;
    try {
      return new URL(value).protocol === "https:" || "Use an HTTPS URL.";
    } catch {
      return "Use a local path, anchor, or HTTPS URL.";
    }
  },
};
const iconField: Field = {
  name: "icon",
  type: "select",
  required: true,
  options: [
    { label: "Location", value: "map" },
    { label: "Calendar", value: "calendar" },
    { label: "Trophy", value: "trophy" },
    { label: "Shield", value: "shield" },
    { label: "Chart", value: "chart" },
  ],
};
function fieldsFor(defaults: Record<string, unknown>): Field[] {
  return Object.entries(defaults).map(([name, value]): Field => {
    if (Array.isArray(value))
      return {
        name,
        type: "array",
        required: true,
        minRows: 1,
        maxRows: name === "footerLinks" ? 6 : 3,
        defaultValue: value,
        fields:
          name === "footerLinks"
            ? [
                { name: "label", type: "text", required: true, maxLength: 60 },
                link,
              ]
            : [
                { name: "title", type: "text", required: true, maxLength: 100 },
                {
                  name: "body",
                  type: "textarea",
                  required: true,
                  maxLength: 500,
                },
                iconField,
              ],
      };
    if (name.endsWith("Href"))
      return { ...link, name, defaultValue: String(value) };
    const isLong = name.toLowerCase().includes("description");
    if (isLong)
      return {
        name,
        type: "textarea",
        required: true,
        defaultValue: String(value),
        maxLength: 1000,
      };
    return {
      name,
      type: "text",
      required: true,
      defaultValue: String(value),
      maxLength: name.toLowerCase().includes("label") ? 60 : 160,
    };
  });
}
function contentGlobal(
  slug: string,
  label: string,
  defaults: Record<string, unknown>,
): GlobalConfig {
  return {
    slug,
    label,
    admin: {
      group: "Website content",
      description:
        "Save a draft to review your changes. Publish when you're ready for them to appear on the website.",
    },
    access: {
      read: canManageContent,
      update: canManageContent,
      readVersions: canManageContent,
    },
    versions: { drafts: true, max: 30 },
    fields: fieldsFor(defaults),
  };
}
export const contentGlobals = [
  contentGlobal("homepage", "Homepage", homeDefaults),
  contentGlobal("site-settings", "Header & footer", siteDefaults),
  contentGlobal("venue-landing", "Venue landing page", venueLandingDefaults),
];

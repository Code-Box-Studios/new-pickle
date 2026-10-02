"use client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Toaster } from "./sonner";

type ToastInput = {
  title: string;
  description?: string;
  tone?: "default" | "success" | "error";
};
function notify({ title, description, tone }: ToastInput) {
  const show =
    tone === "success" ? toast.success : tone === "error" ? toast.error : toast;
  show(title, { description });
}
export function useToast() {
  return notify;
}
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
        duration={5000}
        offset={24}
        mobileOffset={{ bottom: 100, left: 16, right: 16 }}
      />
    </>
  );
}

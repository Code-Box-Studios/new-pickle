import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SetupActions({
  venueId,
  back,
  label,
  onContinue,
  loading,
  disabled,
}: {
  venueId: string;
  back: string;
  label: string;
  onContinue: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <Button
        asChild
        variant="ghost"
        disabled={loading || disabled}
        className="px-3"
      >
        <Link href={`/owner/venues/${venueId}/${back}`}>
          <ArrowLeft aria-hidden /> Back
        </Link>
      </Button>
      <Button
        loading={loading}
        disabled={disabled}
        onClick={onContinue}
        className="px-4 sm:px-6"
      >
        {label}
        <ArrowRight aria-hidden />
      </Button>
    </div>
  );
}

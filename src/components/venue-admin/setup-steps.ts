import {
  Building2,
  Camera,
  Clock3,
  ClipboardCheck,
  CreditCard,
} from "lucide-react";
import { PaddleIcon } from "@/components/ui/pickleball";

export const SETUP_STEPS = [
  {
    key: "details",
    label: "Details",
    title: "Make it yours.",
    description: "Introduce your venue and help players find their way.",
    icon: Building2,
  },
  {
    key: "photos",
    label: "Photos",
    title: "A good first impression.",
    description: "Give players a feel for the place before their first game.",
    icon: Camera,
  },
  {
    key: "courts",
    label: "Courts",
    title: "Room for every rally.",
    description: "Add your courts, playing conditions, and hourly rates.",
    icon: PaddleIcon,
  },
  {
    key: "hours",
    label: "Hours",
    title: "Set your game time.",
    description: "Choose when your courts are open for reservations.",
    icon: Clock3,
  },
  {
    key: "payments",
    label: "Payments",
    title: "Keep payments simple.",
    description: "Tell players how to pay your venue directly.",
    icon: CreditCard,
  },
  {
    key: "review",
    label: "Review",
    title: "Ready for your first players?",
    description: "Check your setup and submit your venue for verification.",
    icon: ClipboardCheck,
  },
] as const;

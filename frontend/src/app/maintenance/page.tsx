import { Plane } from "lucide-react";
import { AIRLINE_NAME, LOGO_ICON } from "@/lib/branding";

export default function MaintenancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-24 h-24 flex items-center justify-center mb-6">
        <img 
          src={LOGO_ICON} 
          alt={AIRLINE_NAME} 
          className="h-full w-auto"
        />
      </div>
      <h1 className="text-3xl font-bold mb-3">Under Maintenance</h1>
      <p className="text-muted-foreground max-w-md mb-2">
        {AIRLINE_NAME} is currently undergoing scheduled maintenance.
        We&apos;ll be back in the air shortly.
      </p>
      <p className="text-sm text-muted-foreground">
        Please check our Discord for live updates.
      </p>
    </div>
  );
}

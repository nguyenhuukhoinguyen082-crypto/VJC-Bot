import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plane } from "lucide-react";
import { AIRLINE_NAME, LOGO_ICON } from "@/lib/branding";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="relative mb-8">
        <div className="text-[10rem] font-black leading-none bg-gradient-to-b from-emerald-500/30 to-transparent bg-clip-text text-transparent select-none">
          404
        </div>
        <img 
          src={LOGO_ICON} 
          alt={AIRLINE_NAME} 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-auto animate-pulse"
        />
      </div>
      <h1 className="text-2xl font-bold mb-2">Flight Not Found</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Looks like this route doesn&apos;t exist in our flight network. Let&apos;s get you back on course.
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
            Return Home
          </Button>
        </Link>
        <Link href="/flights">
          <Button variant="outline">Search Flights</Button>
        </Link>
      </div>
    </div>
  );
}

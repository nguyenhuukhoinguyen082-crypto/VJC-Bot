import type { Metadata } from "next";
import { AIRLINE_NAME, AIRLINE_SHORT_NAME } from "@/lib/branding";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TosPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <p className="text-xs text-muted-foreground mb-2">Last updated: May 21, 2026</p>
      <h1 className="text-3xl font-extrabold mb-8 tracking-tight text-foreground bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Terms of Service</h1>

      <div className="prose prose-invert prose-emerald max-w-none space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section id="acceptance" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">1. Acceptance of the Agreement</h2>
          <p>
            By registering an account, accessing, or interacting with the website, services, or associated Discord servers operated by <strong>{AIRLINE_NAME} Virtual</strong> (hereafter referred to as the &quot;Service&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. 
          </p>
          <p>
            If you do not agree to these terms, you must immediately cease all access and use of the Service. Continued utilization of our web panels, database records, flight loggers, and community spaces constitutes an ongoing and active acceptance of this agreement in full.
          </p>
        </section>

        <section id="simulation-disclaimer" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">2. Virtual Airline & Simulation Disclaimer</h2>
          <p>
            {AIRLINE_NAME} Virtual is a non-profit, fan-made virtual airline community designed exclusively for use within flight simulation platforms (such as Roblox, Microsoft Flight Simulator, X-Plane, and Prepar3D). 
          </p>
          <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/10 text-xs">
            <strong>IMPORTANT:</strong> We are <strong>NOT affiliated</strong> with, authorized by, sponsored by, or associated in any way with any real-world airline. All airline names, logos, branding, trademarks, aircraft paint schemes, and intellectual property remain the sole property of their respective real-world owners.
          </div>
          <p>
            All schedules, flights, ticket bookings, airline routes, and staff assignments represented on this Service are purely virtual. They do not represent real-world operations, carry no legal status, and cannot be used for physical travel or passenger transport in the real world.
          </p>
        </section>

        <section id="eligibility-accounts" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">3. User Eligibility and Account Security</h2>
          <p>
            To use our Service, you must comply with the following registration requirements:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Age Restrictions:</strong> You must be at least 13 years of age. In compliance with the Children&apos;s Online Privacy Protection Act (COPPA) and Discord&apos;s Terms of Service, we do not permit users under 13 to create accounts or join our community.</li>
            <li><strong>Authentication:</strong> All user registration and subsequent logins are handled securely via third-party Discord OAuth2 credentials. You agree to secure your Discord account credentials appropriately.</li>
            <li><strong>Account Integrity:</strong> You are strictly prohibited from sharing your account with other users or attempting to gain unauthorized access to accounts belonging to others. One user is permitted to hold exactly one active account. Duplicate &quot;alt&quot; accounts created to bypass bans or exploit economic mechanics will be permanently banned.</li>
            <li><strong>Roblox Linking:</strong> You must provide a valid Roblox Username and Discord ID to link your virtual profile. Falsifying this information to impersonate other community members or Roblox players will result in immediate termination of your access.</li>
          </ul>
        </section>

        <section id="virtual-economy" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">4. Virtual Economy and Mile Rewards</h2>
          <p>
            Our Service features a gamified virtual economy system utilizing virtual currency (VND) and flight miles.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>No Real-World Value:</strong> All virtual balances, airline miles, transactions, wallet holdings, and purchased bookings have absolutely zero physical or monetary value. They cannot be sold, traded, transferred outside the Service, or redeemed for real-world currency or assets.</li>
            <li><strong>Earning Mechanics:</strong> Virtual currency is earned solely through interactive community activities, including but not limited to, simulated flight completions, discord engagement, and in-site mini-games (e.g. via our Discord bot `/work` commands).</li>
            <li><strong>Economic Balance Rights:</strong> The administration team reserves the absolute right to reset, adjust, modify, or delete any user&apos;s virtual balances (VND and miles) at any time. This action may be taken to fix database corruption, patch system exploits, rebalance the economy, or penalize malicious user behavior.</li>
          </ul>
        </section>

        <section id="conduct" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">5. User Code of Conduct</h2>
          <p>
            As a member of our community, you agree to maintain a safe, friendly, and respectful environment. You are strictly prohibited from engaging in the following actions:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Harassing, threatening, abusing, or defaming other members, staff, or guests.</li>
            <li>Using cheats, bots, scripts, automated macros, or hacking tools to log fake flight simulation hours, farm virtual currency, or corrupt leaderboard rankings.</li>
            <li>Exploiting backend bugs, UI glitches, or API endpoints. Any discovered vulnerabilities must be privately reported to our Development team.</li>
            <li>Spamming, advertising external services, or posting inappropriate/explicit content in any community channels or booking pipelines.</li>
          </ul>
        </section>

        <section id="moderation" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">6. Moderation and Termination</h2>
          <p>
            To preserve community guidelines, our moderation team (including staff, directors, and developers) has the authority to review user actions. 
          </p>
          <p>
            Violations of these terms may result in immediate disciplinary actions, including:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Formal warnings tracked on your moderation profile.</li>
            <li>Temporary suspension of login access to the booking panel and site dashboards.</li>
            <li>Permanent ban and blacklisting from all {AIRLINE_NAME} Virtual platforms, including the Roblox groups, website, and Discord server.</li>
          </ul>
          <p>
            We reserve the right to refuse service, terminate accounts, or restrict access to any user at our absolute discretion, without prior notice or liability.
          </p>
        </section>

        <section id="limitation-liability" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">7. Limitation of Liability and Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR FREE OF ERROR, VIRUSES, OR BUGS. 
          </p>
          <p>
            IN NO EVENT SHALL {AIRLINE_NAME} VIRTUAL, ITS DEVELOPERS, DIRECTORS, OR STAFF BE LIABLE FOR ANY DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, LOSS OF DATA, COMPUTER FAILURE, OR LOSS OF SIMULATED PROGRESS) ARISING OUT OF THE USE OF OR INABILITY TO USE THE SERVICE.
          </p>
        </section>

        <section id="amendments" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">8. Amendments to Terms</h2>
          <p>
            We reserve the right to review and update these terms at our sole discretion. Any changes will be posted immediately on this page with an updated &quot;Last updated&quot; timestamp. Your continued access to the Service following the posting of modifications indicates your agreement to be bound by the updated terms.
          </p>
        </section>

        <section id="contact" className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">9. Contact and Community Inquiries</h2>
          <p>
            If you have any questions, feedback, or need clarification regarding these Terms of Service, please reach out to our administration team by opening a support ticket inside our official Discord server or contacting a Developer/Director directly.
          </p>
        </section>
      </div>
    </div>
  );
}

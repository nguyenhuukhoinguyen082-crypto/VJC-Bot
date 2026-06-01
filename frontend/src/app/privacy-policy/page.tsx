import type { Metadata } from "next";
import { AIRLINE_NAME } from "@/lib/branding";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <p className="text-xs text-muted-foreground mb-2">Last updated: May 21, 2026</p>
      <h1 className="text-3xl font-extrabold mb-8 tracking-tight text-foreground bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Privacy Policy</h1>

      <div className="prose prose-invert prose-emerald max-w-none space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">1. Introduction</h2>
          <p>
            Welcome to <strong>{AIRLINE_NAME} Virtual</strong> (hereafter referred to as the &quot;Service&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We respect your privacy and are committed to protecting any personal data you share with us.
          </p>
          <p>
            This Privacy Policy details the types of information we collect, how we store and process it, and your rights regarding your personal information in connection with your use of our virtual flight booking panels, discord bot features, and flight log databases.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">2. Information We Collect</h2>
          <p>
            We collect information that you directly provide to us, as well as data automatically generated during your interactions with the Service:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Authentication & Account Data (Discord OAuth2):</strong> We authenticate users via Discord. When you log in, we retrieve your Discord ID, Discord username/nickname, Discord email address, and avatar image. We do not collect or store your Discord account password.
            </li>
            <li>
              <strong>Roblox Linking Information:</strong> To link your simulated flights and verify in-game statistics, we request and store your Roblox Username, Roblox ID, and associated Discord user ID.
            </li>
            <li>
              <strong>Flight Simulation & Booking Data:</strong> We collect details of bookings you place via our `/booking` pipeline. This includes selected seat letters, flight paths, ticket class, and passenger profiles containing your display name, Roblox Username, Discord ID, nationality, and any specified special requests. We also log your flight miles, flights completed, and flight logs.
            </li>
            <li>
              <strong>Virtual Economy Transactions:</strong> All mock transactions, including virtual currency (VND) balances, work earnings, miles history, and booking refund logs are recorded to maintain database integrity.
            </li>
            <li>
              <strong>Log and Device Data:</strong> Our servers automatically log connection parameters, including your IP address, browser type, operating system version, referring pages, and access timestamps.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">3. How We Use Your Information</h2>
          <p>
            We process your information for the following legitimate, non-commercial purposes:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provision, maintain, secure, and debug our virtual airline web application.</li>
            <li>To verify your identity, permissions, and group authorization level (dev, director, staff, or standard user) using Discord OAuth2 scopes.</li>
            <li>To manage virtual seat assignments, bookings, check-in, and boarding logs.</li>
            <li>To run public community leaderboards, rank flight achievements, and award virtual miles.</li>
            <li>To monitor, audit, and investigate security threats, bot abuses, or game-breaking exploits.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">4. Data Storage and Security</h2>
          <p>
            The security of your information is our priority. We employ reasonable technical measures to secure our systems:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Encrypted Connections:</strong> All web traffic is strictly encrypted using HTTPS (SSL/TLS) during transit.</li>
            <li><strong>Access Controls:</strong> Database modification privileges are strictly restricted to authorized administrator roles (Developers and Directors). Staff users are only granted access to read and update check-in/boarding flight manifest states.</li>
            <li><strong>No Real-World Financial Data:</strong> We do not ask for, collect, or process any real-world credit cards, bank accounts, or financial transaction logs. All economy features on our site are purely simulated.</li>
          </ul>
          <p>
            Please note that no method of transmission over the internet or database storage is 100% secure. While we strive to protect your data, we cannot guarantee its absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">5. Data Sharing and Third-Party Integrations</h2>
          <p>
            We do <strong>not</strong> sell, rent, or lease your personal information to third parties. We only share information with third-party systems under the following specific contexts:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Discord API:</strong> Discord manages login credentials, user authorization, and webhook logs. Your interaction with Discord is subject to the <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Discord Privacy Policy</a>.</li>
            <li><strong>Roblox API:</strong> If you verify your flight achievements via in-game Roblox systems, stats may be communicated through Roblox game server webhooks. Your use of Roblox is subject to the <a href="https://en.help.roblox.com/hc/articles/115004630823" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Roblox Privacy Policy</a>.</li>
            <li><strong>Compliance with Law:</strong> We may release information when required to do so by applicable laws, regulations, or legal processes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">6. Cookies and Browser Local Storage</h2>
          <p>
            We use browser Local Storage and temporary session cookies to store your current login token (JWT), authentication state, and interface preferences (such as light/dark mode choices). This ensures you stay signed in as you navigate between different routes of our booking panel. You can configure your browser to reject cookies, but some components of the Service may cease to function correctly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">7. Children&apos;s Privacy (COPPA Compliance)</h2>
          <p>
            Our Service is strictly intended for individuals who are 13 years of age or older. We do not knowingly collect, request, or maintain personal information from children under the age of 13. If you are under 13, please do not attempt to register an account or submit any personal information. 
          </p>
          <p>
            If we discover that a user under the age of 13 has registered and provided us with data, we will immediately delete their account and wipe all associated details from our backend database.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">8. Your Rights: Access, Correction, and Deletion</h2>
          <p>
            You have control over your data. You have the right to request access to the information we store about your profile, correct any inaccurate records, or request complete account and data deletion.
          </p>
          <p>
            To request a complete deletion of your account and purge all booking history, passenger lists, and logged miles, please open a support ticket in our official Discord server. Once verified, our developers will permanently erase your database records within 7 business days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground border-b border-border/40 pb-2">9. Updates to this Policy</h2>
          <p>
            We reserve the right to modify this Privacy Policy at any time. Any changes will be posted on this page with an updated &quot;Last updated&quot; timestamp at the top of this document. We encourage you to periodically review this policy to stay informed about how we safeguard your data.
          </p>
        </section>
      </div>
    </div>
  );
}

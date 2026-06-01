"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  Shield,
  Globe,
  Users,
  ArrowRight,
  MapPin,
  Clock,
  Star,
} from "lucide-react";
import { fleetData, teamData } from "@/lib/data";
import { AIRLINE_NAME, AIRLINE_DESCRIPTION, HERO } from "@/lib/branding";

const stats = [
  { icon: Shield, label: "Safety Record", value: "100%", desc: "Zero incidents" },
  { icon: Plane, label: "Fleet Size", value: `${3}`, desc: "Modern aircraft" },
  { icon: Globe, label: "Destinations", value: "8+", desc: "Across Vietnam" },
];

const featuredRoutes = [
  { from: "HAN", to: "DAD", fromName: "Hanoi", toName: "Da Nang", price: "2,408,000", duration: "1h 25m" },
  { from: "HAN", to: "SGN", fromName: "Hanoi", toName: "Ho Chi Minh", price: "2,138,000", duration: "2h 10m" },
  { from: "SGN", to: "PQC", fromName: "Ho Chi Minh", toName: "Phu Quoc", price: "1,648,000", duration: "1h 05m" },
  { from: "DAD", to: "CXR", fromName: "Da Nang", toName: "Cam Ranh", price: "1,382,000", duration: "1h 15m" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-background to-teal-50/50" />
        <div className="absolute top-20 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl" />

        <div className="container relative mx-auto px-4 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8 }}
          >
            <Badge
              variant="secondary"
              className="mb-6 px-4 py-1.5 text-sm bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            >
              ✈️ Virtual Airline Experience
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-black mb-6 leading-tight"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            {HERO.title}
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {HERO.subtitle}
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-4"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <Link href="/booking">
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/25 px-8 h-12 text-base"
              >
                Book a Flight
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/flights">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base border-border/50">
                Track Flight
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-emerald-400" />
          </div>
        </motion.div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <stat.icon className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                <div className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm font-medium">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Routes */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Popular{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Routes
              </span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Explore our most popular domestic routes with competitive fares.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredRoutes.map((route, i) => (
              <motion.div
                key={`${route.from}-${route.to}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="group cursor-pointer hover:border-emerald-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5 bg-card/50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-black">{route.from}</div>
                        <div className="text-xs text-muted-foreground">{route.fromName}</div>
                      </div>
                      <div className="flex-1 mx-3 flex items-center">
                        <div className="h-px flex-1 bg-border" />
                        <Plane className="h-4 w-4 text-emerald-600 mx-2 group-hover:translate-x-1 transition-transform" />
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-black">{route.to}</div>
                        <div className="text-xs text-muted-foreground">{route.toName}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {route.duration}
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">from </span>
                        <span className="text-lg font-bold text-emerald-600">{route.price}</span>
                        <span className="text-xs text-muted-foreground"> VND</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Fleet Preview */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Our{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Fleet
              </span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Modern, efficient aircraft connecting you to your destination safely.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {fleetData.map((aircraft, i) => (
              <motion.div
                key={aircraft.registration}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="overflow-hidden group hover:border-emerald-500/30 transition-all bg-card/50">
                  <div className="h-40 bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
                    <Plane className="h-16 w-16 text-emerald-600/30 group-hover:text-emerald-600/50 transition-colors" />
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold">{aircraft.registration}</h3>
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      >
                        {aircraft.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{aircraft.model}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{aircraft.type}</span>
                      <span>{aircraft.capacity}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/fleet">
              <Button variant="outline" className="border-border/50">
                View Full Fleet
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Team Preview */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Meet the{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Team
              </span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              The dedicated team behind {AIRLINE_NAME} virtual operations.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {teamData.map((member, i) => (
              <motion.div
                key={member.username}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="text-center hover:border-emerald-500/30 transition-all bg-card/50">
                  <CardContent className="p-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                      {member.username.slice(0, 2).toUpperCase()}
                    </div>
                    <h3 className="font-bold">{member.username}</h3>
                    <p className="text-sm text-emerald-600">{member.title}</p>
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" />
                      {member.experience}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/team">
              <Button variant="outline" className="border-border/50">
                Meet Full Team
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden border-t border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-background to-teal-50/50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="container relative mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Take Off?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              Join thousands of virtual travelers and experience premium aviation
              with {AIRLINE_NAME}.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/25 px-8"
                >
                  Create Account
                </Button>
              </Link>
              <Link href="/flights">
                <Button variant="outline" size="lg" className="border-border/50 px-8">
                  Browse Flights
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

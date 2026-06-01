"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Briefcase } from "lucide-react";
import { teamData } from "@/lib/data";
import { AIRLINE_NAME } from "@/lib/branding";

export default function TeamPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold mb-3">
          Our{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Team
          </span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          The people behind {AIRLINE_NAME} virtual operations.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {teamData.map((member, i) => (
          <motion.div
            key={member.username}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="text-center hover:border-emerald-500/30 transition-all bg-card/50 group">
              <CardContent className="p-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-5 text-white text-2xl font-bold group-hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20">
                  {member.username.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="text-lg font-bold">{member.username}</h3>
                <p className="text-sm text-emerald-600 mt-1">{member.title}</p>
                <div className="flex items-center justify-center gap-3 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {member.department}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {member.experience}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

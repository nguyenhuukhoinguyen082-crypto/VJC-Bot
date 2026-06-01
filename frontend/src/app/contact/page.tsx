"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    // Simulate submission
    await new Promise((r) => setTimeout(r, 1000));
    toast.success("Message sent! We'll get back to you soon.");
    (e.target as HTMLFormElement).reset();
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold mb-3">
          Contact{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Us
          </span>
        </h1>
        <p className="text-muted-foreground">
          Have a question? Send us a message or reach out on Discord.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-card/50">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact-name" className="text-xs text-muted-foreground">Name</Label>
                  <Input id="contact-name" name="name" required placeholder="Your name" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="contact-email" className="text-xs text-muted-foreground">Email</Label>
                  <Input id="contact-email" name="email" type="email" required placeholder="you@example.com" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="contact-subject" className="text-xs text-muted-foreground">Subject</Label>
                <Select name="subject" required>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                    <SelectItem value="booking">Booking Issue</SelectItem>
                    <SelectItem value="technical">Technical Support</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contact-message" className="text-xs text-muted-foreground">Message</Label>
                <Textarea
                  id="contact-message"
                  name="message"
                  required
                  placeholder="Tell us what you need help with..."
                  rows={5}
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
              >
                {loading ? "Sending..." : <>Send Message <Send className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">For faster support, join our Discord:</p>
          <a
            href="https://discord.gg/pFgPqSKwFp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Join Discord
            </Button>
          </a>
        </div>
      </motion.div>
    </div>
  );
}

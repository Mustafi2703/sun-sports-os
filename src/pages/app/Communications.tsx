import { useState } from "react";
import { MessageCircle, Send, Mail, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const automations = [
  { id: "a1", title: "Fee overdue by 3 days", desc: "WhatsApp reminder to parent", on: true, channel: "WhatsApp" },
  { id: "a2", title: "Fee overdue by 7 days", desc: "WhatsApp + SMS escalation", on: true, channel: "WhatsApp + SMS" },
  { id: "a3", title: "Student absent 3 consecutive sessions", desc: "Alert parent and admin", on: true, channel: "WhatsApp" },
  { id: "a4", title: "Payment received confirmation", desc: "Auto-send digital receipt", on: true, channel: "WhatsApp + Email" },
  { id: "a5", title: "Monthly progress card ready", desc: "Sent at start of every month", on: true, channel: "WhatsApp" },
  { id: "a6", title: "Birthday wishes", desc: "Personalised on student birthday", on: true, channel: "WhatsApp" },
  { id: "a7", title: "Batch schedule change", desc: "Notify when timing changes", on: false, channel: "WhatsApp + SMS" },
];

const Communications = () => {
  const [items, setItems] = useState(automations);
  const [recipient, setRecipient] = useState("all");
  const [channel, setChannel] = useState("whatsapp");
  const [msg, setMsg] = useState("");

  const toggle = (id: string) => setItems(prev => prev.map(a => a.id === id ? { ...a, on: !a.on } : a));

  return (
    <div className="space-y-5">
      <PageHeader title="Communications" description="Automate routine messages and send manual broadcasts." />

      <Tabs defaultValue="automated">
        <TabsList>
          <TabsTrigger value="automated">Automated</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="automated" className="mt-5 space-y-2.5">
          {items.map(a => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.desc} • {a.channel}</p>
              </div>
              <Switch checked={a.on} onCheckedChange={() => toggle(a.id)} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="manual" className="mt-5">
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Recipients</label>
                    <Select value={recipient} onValueChange={setRecipient}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Parents</SelectItem>
                        <SelectItem value="batch">Specific Batch</SelectItem>
                        <SelectItem value="overdue">Overdue Parents</SelectItem>
                        <SelectItem value="individual">Individual Parent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Channel</label>
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Template</label>
                  <Select defaultValue="custom">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom message</SelectItem>
                      <SelectItem value="holiday">Holiday notice</SelectItem>
                      <SelectItem value="event">Tournament announcement</SelectItem>
                      <SelectItem value="reminder">Practice reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Message</label>
                  <Textarea rows={6} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write your message here. Use {parent_name}, {student_name} for personalization." />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline">Preview</Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("Message broadcast started — 85 recipients")}>
                    <Send className="h-4 w-4 mr-1.5" /> Send
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs text-muted-foreground">Sent this month</p>
                <p className="font-display text-3xl font-bold mt-1">412</p>
                <p className="text-xs text-primary mt-1">94% delivery rate</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-medium">Channel breakdown</p>
                {[
                  { i: MessageCircle, l: "WhatsApp", v: "346", t: "text-primary" },
                  { i: Smartphone, l: "SMS", v: "42", t: "text-secondary" },
                  { i: Mail, l: "Email", v: "24", t: "text-amber-400" },
                ].map(c => {
                  const Icon = c.i;
                  return (
                    <div key={c.l} className="flex items-center justify-between">
                      <span className={`flex items-center gap-2 text-sm ${c.t}`}><Icon className="h-4 w-4" /> {c.l}</span>
                      <span className="text-sm">{c.v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Communications;
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Academy profile, preferences, and integrations." />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Academy profile">
          <Field label="Academy name" defaultValue="Champions Cricket Academy" />
          <Field label="Owner" defaultValue="Shrey Trivedi" />
          <Field label="Phone" defaultValue="+91 98250 00000" />
          <Field label="Address" defaultValue="Ahmedabad, Gujarat" />
        </Card>

        <Card title="Notifications">
          <Toggle label="Daily email summary" defaultChecked />
          <Toggle label="WhatsApp alerts for overdue fees" defaultChecked />
          <Toggle label="Coach push notifications" defaultChecked />
          <Toggle label="Parent portal access alerts" />
        </Card>

        <Card title="WhatsApp integration">
          <Field label="Business number" defaultValue="+91 98250 00001" />
          <p className="text-xs text-primary">✓ Connected to WhatsApp Business API</p>
        </Card>

        <Card title="Plan">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="font-display font-bold text-lg">Professional</p>
            <p className="text-sm text-muted-foreground">₹10,000 / month • 5 users • renews Jul 1</p>
            <Button size="sm" className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">Manage subscription</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
    <h3 className="font-display font-semibold">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, defaultValue }: { label: string; defaultValue: string }) => (
  <div>
    <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
    <Input defaultValue={defaultValue} />
  </div>
);

const Toggle = ({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) => (
  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5">
    <span className="text-sm">{label}</span>
    <Switch defaultChecked={defaultChecked} />
  </div>
);

export default Settings;
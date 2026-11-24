import { PageHeader } from "@/components/app/PageHeader";
import { ParentImportPanel } from "@/components/app/ParentImportPanel";

const Parents = () => {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Parents"
        description="Give parents a portal login. Preview the file first, then apply only the rows you leave ticked."
      />
      <ParentImportPanel mode="admin" />
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground space-y-2">
        <p>To set one starting PIN, edit the student and use Starting PIN, or open the student and choose Set starting PIN.</p>
        <p>Settings, Portal users, can also set a starting PIN for one parent login. A blank PIN keeps the shared starting PIN. The parent chooses their own PIN at first sign-in.</p>
      </div>
    </div>
  );
};

export default Parents;

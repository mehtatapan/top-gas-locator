import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5" /> Coming soon
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p>The database schema, permissions, and Google Drive folder structure for this module are ready.</p>
          <p className="mt-2">The full UI ships in the next update.</p>
        </CardContent>
      </Card>
    </div>
  );
}

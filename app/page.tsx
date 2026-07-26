import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          AdiV
        </h1>
        <p className="text-xl text-muted-foreground">
          ADV160 Maintenance Tracker
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Your personal motorcycle maintenance companion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="default">Maintenance</Badge>
            <Badge variant="secondary">Rides</Badge>
            <Badge variant="outline">Fuel</Badge>
            <Badge variant="destructive">Expenses</Badge>
          </div>
          <Link href="/setup" className="w-full">
            <Button className="w-full">Get Started</Button>
          </Link>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        Honda ADV160 RoadSync
      </div>
    </main>
  );
}

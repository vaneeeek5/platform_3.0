"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function SyncSettings({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [schedule, setSchedule] = useState("0 0 * * *");
  const [periodDays, setPeriodDays] = useState(1);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSyncEnabled(data.syncEnabled || false);
          setSchedule(data.syncSchedule || "0 0 * * *");
          setPeriodDays(data.syncPeriodDays || 1);
        }
        setLoading(false);
      });
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncEnabled,
          syncSchedule: schedule,
          syncPeriodDays: periodDays,
        }),
      });

      if (res.ok) {
        toast.success("Sync settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Synchronization Schedule</CardTitle>
          <CardDescription>
            Configure how often data is pulled from Yandex and CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Auto-Sync</Label>
              <p className="text-sm text-muted-foreground">
                Run background jobs according to the schedule.
              </p>
            </div>
            <input 
              type="checkbox" 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule">Sync Frequency</Label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger id="schedule">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0 * * * *">Every hour</SelectItem>
                  <SelectItem value="0 */4 * * *">Every 4 hours</SelectItem>
                  <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                  <SelectItem value="0 0 * * 0">Weekly on Sundays</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Sync Period (Days)</Label>
              <Input
                id="period"
                type="number"
                min="1"
                max="30"
                value={periodDays}
                onChange={(e) => setPeriodDays(parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                How many days of history to pull on each sync.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save All Sync Settings"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM Status Mapping</CardTitle>
          <CardDescription>
            Map incoming CRM statuses to platform internal statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground italic">
             Status mapping configuration will be available after the first CRM sync.
           </p>
        </CardContent>
      </Card>
    </div>
  );
}

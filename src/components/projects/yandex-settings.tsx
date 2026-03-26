"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Goal {
  id: string;
  name: string;
  type: string;
}

export function YandexSettings({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true);
  const [fetchingGoals, setFetchingGoals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [counterId, setCounterId] = useState("");
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  const [trackedGoalIds, setTrackedGoalIds] = useState<string[]>([]);

  useEffect(() => {
    // Load initial project settings and tracked goals
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(res => res.json()),
      fetch(`/api/projects/${projectId}/tracked-goals`).then(res => res.json())
    ]).then(([project, goals]) => {
      if (project) {
        setToken(project.yandexToken || "");
        setCounterId(project.yandexCounterId || "");
      }
      if (Array.isArray(goals)) {
        setTrackedGoalIds(goals.map((g: any) => g.goalId));
      }
      setLoading(false);
    });
  }, [projectId]);

  const handleSaveGoals = async () => {
    const goalsToSave = availableGoals
      .filter(g => trackedGoalIds.includes(g.id))
      .map(g => ({ goalId: g.id, goalName: g.name }));

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tracked-goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: goalsToSave }),
      });

      if (res.ok) {
        toast.success("Tracked goals updated");
      } else {
        toast.error("Failed to update goals");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const fetchGoals = async () => {
    if (!token || !counterId) {
       toast.error("Token and Counter ID are required");
       return;
    }
    setFetchingGoals(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/metrika/goals?token=${token}&counterId=${counterId}`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setAvailableGoals(data);
        toast.success(`Found ${data.length} goals`);
      }
    } catch (e) {
      toast.error("Failed to fetch goals");
    } finally {
      setFetchingGoals(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yandexToken: token,
          yandexCounterId: counterId,
        }),
      });

      if (res.ok) {
        toast.success("Yandex settings saved");
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
          <CardTitle>Yandex Metrika API</CardTitle>
          <CardDescription>
            Configure Yandex Direct/Metrika credentials to fetch lead data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="token">OAuth Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="y0_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="counter">Counter ID</Label>
              <Input
                id="counter"
                placeholder="12345678"
                value={counterId}
                onChange={(e) => setCounterId(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={fetchGoals} variant="outline" disabled={fetchingGoals}>
            {fetchingGoals ? "Fetching..." : "Fetch Goals"}
          </Button>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Credentials"}
          </Button>
        </CardFooter>
      </Card>

      {availableGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Metrika Goals</CardTitle>
            <CardDescription>
              Select goals that should be tracked as leads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Track</TableHead>
                  <TableHead>Goal ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableGoals.map((goal) => (
                  <TableRow key={goal.id}>
                    <TableCell>
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        checked={trackedGoalIds.includes(goal.id)}
                        onChange={(e) => {
                           if (e.target.checked) {
                              setTrackedGoalIds([...trackedGoalIds, goal.id]);
                           } else {
                              setTrackedGoalIds(trackedGoalIds.filter(id => id !== goal.id));
                           }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{goal.id}</TableCell>
                    <TableCell>{goal.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{goal.type}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
             <Button onClick={handleSaveGoals} disabled={saving || availableGoals.length === 0}>
                {saving ? "Saving..." : "Save Tracked Goals"}
             </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

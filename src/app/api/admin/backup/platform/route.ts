import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backupDir = "/root/backups";
    if (!fs.existsSync(backupDir)) {
      try {
        fs.mkdirSync(backupDir, { recursive: true });
      } catch (e) {
        // If we can't create it in /root/, try local storage
        const localBackupDir = path.join(process.cwd(), "storage", "backups", "platform");
        if (!fs.existsSync(localBackupDir)) fs.mkdirSync(localBackupDir, { recursive: true });
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `platform_backup_${timestamp}.tar.gz`;
    const filePath = path.join(backupDir, fileName);
    
    // Command to create archive excluding large folders
    // We exclude node_modules, .next, .git to keep it fast and small
    const cmd = `tar -czf ${filePath} --exclude='node_modules' --exclude='.next' --exclude='.git' .`;

    await execAsync(cmd, { cwd: process.cwd() });

    return NextResponse.json({ 
        success: true, 
        fileName,
        path: filePath,
        timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Platform backup error:", error);
    return NextResponse.json({ error: "Failed to create platform snapshot" }, { status: 500 });
  }
}

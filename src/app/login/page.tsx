"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        toast.success("Вход выполнен успешно")
        router.push("/admin/projects")
      } else {
        const data = await res.json()
        toast.error(data.error || "Неверный логин или пароль")
      }
    } catch (error) {
      toast.error("Произошла ошибка при входе")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background relative selection:bg-primary selection:text-white overflow-hidden">
      {/* Background Decorative Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full animate-pulse opacity-50 pointer-events-none" />
      
      <Card className="w-full max-w-[400px] glass-card border-none shadow-[0_32px_64px_-12px_rgba(40,0,184,0.12)] rounded-[2.5rem] relative overflow-hidden animate-in fade-in zoom-in-95 duration-1000">
        <CardHeader className="space-y-4 p-10 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-primary/20 mb-2 rotate-12 transition-transform hover:rotate-0 duration-500">
             <span className="text-white font-black text-2xl">P</span>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-4xl font-black tracking-tighter text-foreground uppercase">Вход</CardTitle>
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">
              Доступ к платформе 3.0
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-6 px-10 pb-10">
            <div className="space-y-3 group">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 group-focus-within:text-primary transition-colors ml-1">Эл. почта</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="rounded-2xl h-14 glass-card border-white/5 focus-visible:ring-primary/20 px-6 font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
            </div>
            <div className="space-y-3 group">
              <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 group-focus-within:text-primary transition-colors ml-1">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  className="rounded-2xl h-14 glass-card border-white/5 focus-visible:ring-primary/20 px-6 font-bold"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
            </div>
            <Button className="w-full h-14 rounded-2xl bg-primary text-white hover:bg-primary/90 transition-all font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-[0.98]" type="submit" disabled={loading}>
              {loading ? "Авторизация..." : "Войти в систему"}
            </Button>
          </CardContent>
          <CardFooter className="py-6 bg-white/5 dark:bg-black/20 border-t border-white/5 justify-center">
             <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 italic">© 2026 Premium Analytics Platform</p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

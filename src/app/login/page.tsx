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
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-sm rounded-[2rem] shadow-2xl border-none">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Вход в систему</CardTitle>
          <CardDescription className="text-center">
            Введите ваши данные для доступа к платформе
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="rounded-2xl h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  className="rounded-2xl h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-11 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" type="submit" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

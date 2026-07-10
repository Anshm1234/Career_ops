import { Suspense } from "react"
import { AuthScreen } from "@/components/auth/auth-screen"

// Suspense boundary is required because AuthScreen reads useSearchParams()
// (to show "session expired" / confirmation-link error messages).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthScreen />
    </Suspense>
  )
}

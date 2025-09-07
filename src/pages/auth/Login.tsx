import { LoginForm as MagicLinkLogin } from '@/components/login-form'
import { LoginForm as PasswordLogin } from '@/shadcn/components/login-form-password'
import { LoginForm as SocialLogin } from '@/shadcn/components/login-form-social'

export function AuthLogin(){
  return (
    <div className="space-y-6">
      <MagicLinkLogin />
      <PasswordLogin />
      <SocialLogin />
    </div>
  )
}

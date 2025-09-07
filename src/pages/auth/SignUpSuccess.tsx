export function AuthSignUpSuccess(){
  return (
    <div className="rounded border p-4 space-y-2">
      <div className="font-medium">注册成功</div>
      <div className="text-sm text-muted-foreground">
        请前往邮箱完成验证，然后返回登录。
      </div>
    </div>
  )
}

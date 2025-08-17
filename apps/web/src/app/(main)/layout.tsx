import { MainNav } from '@/components/navigation/main-nav'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <MainNav />
      {children}
    </>
  )
}
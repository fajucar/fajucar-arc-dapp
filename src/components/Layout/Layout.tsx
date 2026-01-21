import { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { NetworkSwitcher } from '@/components/Web3/NetworkSwitcher'
import { WalletModal } from '@/components/Web3/WalletModal'
import { useWalletModal } from '@/contexts/WalletModalContext'

interface LayoutProps {
  children: ReactNode
}

function LayoutContent({ children }: LayoutProps) {
  const { isOpen, closeModal } = useWalletModal()
  
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <NetworkSwitcher />
      <WalletModal isOpen={isOpen} onClose={closeModal} />
    </div>
  )
}

export function Layout({ children }: LayoutProps) {
  return <LayoutContent>{children}</LayoutContent>
}


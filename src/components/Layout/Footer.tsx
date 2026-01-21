import { Twitter, Github, MessageCircle, Send } from 'lucide-react'
import { CONSTANTS } from '@/config/constants'

const footerSections = [
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: CONSTANTS.LINKS.docs },
      { label: 'Testnet Faucet', href: CONSTANTS.LINKS.faucet },
      { label: 'Block Explorer', href: CONSTANTS.LINKS.explorer },
      { label: 'GitHub', href: CONSTANTS.LINKS.github },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Whitepaper', href: '#' },
      { label: 'Litepaper', href: '#' },
      { label: 'Security Audits', href: '#' },
      { label: 'Blog', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Terms of Service', href: '#' },
    ],
  },
]

const socialLinks = [
  { icon: Twitter, href: CONSTANTS.LINKS.twitter, label: 'Twitter' },
  { icon: Github, href: CONSTANTS.LINKS.github, label: 'GitHub' },
  { icon: MessageCircle, href: CONSTANTS.LINKS.discord, label: 'Discord' },
  { icon: Send, href: '#', label: 'Telegram' },
]

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-12">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold">
                A
              </div>
              <span className="text-xl font-bold">Arc Network</span>
            </div>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              Purpose-built blockchain for stablecoin finance with deterministic finality and USDC native gas.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="rounded-lg bg-slate-800/50 p-2 hover:bg-slate-800 hover:text-cyan-400 transition-all"
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Arc Network. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-slate-400">Testnet Operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}


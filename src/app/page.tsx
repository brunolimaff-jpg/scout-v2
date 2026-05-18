'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { WarRoomView } from '@/components/war-room-view'
import { ScoutView } from '@/components/scout-view'
import { RadarView } from '@/components/radar-view'
import { CrmView } from '@/components/crm-view'
import { DashboardView } from '@/components/dashboard-view'
import {
  BookOpen,
  Search,
  Radar,
  Users,
  LayoutDashboard,
  Sun,
  Moon,
  Shield,
} from 'lucide-react'

type TabKey = 'warroom' | 'scout' | 'radar' | 'crm' | 'dashboard'

const TABS: Array<{
  key: TabKey
  label: string
  icon: React.ElementType
  shortLabel: string
}> = [
  { key: 'warroom', label: 'War Room', icon: BookOpen, shortLabel: 'War Room' },
  { key: 'scout', label: 'Scout', icon: Search, shortLabel: 'Scout' },
  { key: 'radar', label: 'Radar', icon: Radar, shortLabel: 'Radar' },
  { key: 'crm', label: 'CRM', icon: Users, shortLabel: 'CRM' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortLabel: 'Dash' },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>('warroom')
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const renderView = () => {
    switch (activeTab) {
      case 'warroom':
        return <WarRoomView />
      case 'scout':
        return <ScoutView />
      case 'radar':
        return <RadarView />
      case 'crm':
        return <CrmView />
      case 'dashboard':
        return <DashboardView />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center justify-between px-3 sm:px-4 h-14">
          {/* Logo / Title */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold leading-none">SENIOR SCOUT 360</h1>
              <p className="text-[10px] text-muted-foreground">Inteligência Comercial</p>
            </div>
            <h1 className="sm:hidden text-sm font-bold">SS360</h1>
          </div>

          {/* Tabs - Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Alternar tema</span>
          </Button>
        </div>

        {/* Tabs - Mobile */}
        <nav className="md:hidden flex items-center border-t overflow-x-auto px-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-3 py-2 text-xs whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.shortLabel}</span>
              </button>
            )
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderView()}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 px-4 py-2 mt-auto">
        <p className="text-[10px] text-muted-foreground text-center">
          Senior Scout 360 v3.0 · Inteligência Comercial ·{' '}
          <a
            href="https://documentacao.senior.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-emerald-600 dark:text-emerald-400"
          >
            documentacao.senior.com.br
          </a>
        </p>
      </footer>
    </div>
  )
}

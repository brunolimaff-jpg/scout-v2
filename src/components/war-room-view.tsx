'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Send,
  Plus,
  MessageSquare,
  ChevronDown,
  ExternalLink,
  Loader2,
  BookOpen,
  Trash2,
  Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

// ---------- Types ----------

interface WarRoomSource {
  id: string
  title: string
  url: string
  snippet: string
  relevance: number
}

interface WarRoomMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  intent?: string | null
  confidence?: string | null
  product?: string | null
  module?: string | null
  sources: WarRoomSource[]
  createdAt: string
}

interface WarRoomSession {
  id: string
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

// ---------- Helpers ----------

const INTENT_LABELS: Record<string, string> = {
  documentation: 'Documentação',
  error: 'Erro',
  config: 'Configuração',
  step_by_step: 'Passo a Passo',
  concept: 'Conceito',
  integration: 'Integração',
  business_rule: 'Regra de Negócio',
  unrelated: 'Não Relacionado',
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'Alta', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  medium: { label: 'Média', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  low: { label: 'Baixa', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' },
}

const SUGGESTED_QUESTIONS = [
  'Como configurar uma integração no Senior?',
  'Onde encontro a documentação de determinado módulo?',
  'O que significa este erro?',
  'Quais são os pré-requisitos desta rotina?',
  'Como funciona este processo no sistema?',
  'Qual tela ou parâmetro devo verificar?',
  'Me explique esta documentação em linguagem simples.',
  'Compare duas páginas da documentação e me diga a diferença.',
]

// ---------- Component ----------

export function WarRoomView() {
  const [sessions, setSessions] = useState<WarRoomSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WarRoomMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [showSessionList, setShowSessionList] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/warroom/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Load session messages
  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoadingSession(true)
    try {
      const res = await fetch(`/api/warroom/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(
          (data.messages || []).map((m: WarRoomMessage) => ({
            ...m,
            sources: m.sources || [],
          }))
        )
        setCurrentSessionId(sessionId)
      }
    } catch {
      toast.error('Erro ao carregar sessão')
    } finally {
      setIsLoadingSession(false)
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Create new session
  const createNewSession = async () => {
    try {
      const res = await fetch('/api/warroom/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nova Sessão' }),
      })
      if (res.ok) {
        const session = await res.json()
        setSessions((prev) => [session, ...prev])
        setCurrentSessionId(session.id)
        setMessages([])
        setShowSessionList(false)
      }
    } catch {
      toast.error('Erro ao criar sessão')
    }
  }

  // Delete session
  const deleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/warroom/sessions/${sessionId}`, { method: 'DELETE' })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null)
          setMessages([])
        }
        toast.success('Sessão excluída')
      }
    } catch {
      toast.error('Erro ao excluir sessão')
    }
  }

  // Send message
  const sendMessage = async (messageText?: string) => {
    const text = (messageText || input).trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)

    // Add user message immediately
    const tempUserMsg: WarRoomMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: text,
      sources: [],
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const res = await fetch('/api/warroom/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId || undefined,
          message: text,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to send message')
      }

      const data = await res.json()

      // Update session ID if new
      if (!currentSessionId && data.sessionId) {
        setCurrentSessionId(data.sessionId)
        await loadSessions()
      }

      // Add assistant message
      const assistantMsg: WarRoomMessage = {
        id: data.assistantMessageId || `temp-asst-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        intent: data.intent,
        confidence: data.confidence,
        product: data.keyTerms?.product,
        module: data.keyTerms?.module,
        sources: data.sources || [],
        createdAt: new Date().toISOString(),
      }

      // Replace temp user msg with real one and add assistant
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        {
          ...tempUserMsg,
          id: data.userMessageId || tempUserMsg.id,
          intent: data.intent,
          product: data.keyTerms?.product,
          module: data.keyTerms?.module,
        },
        assistantMsg,
      ])
    } catch {
      toast.error('Erro ao enviar mensagem. Tente novamente.')
      // Remove temp user message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const toggleSources = (messageId: string) => {
    setExpandedSources((prev) => ({ ...prev, [messageId]: !prev[messageId] }))
  }

  const currentSession = sessions.find((s) => s.id === currentSessionId)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">War Room</h2>
              <p className="text-xs text-muted-foreground">
                Inteligência de Documentação Senior
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs hidden sm:flex">
              documentacao.senior.com.br
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSessionList(!showSessionList)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Sessões</span>
            </Button>
            <Button variant="outline" size="sm" onClick={createNewSession}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nova</span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Pergunte sobre produtos, módulos, configurações, integrações e documentação Senior.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Session Sidebar */}
        {showSessionList && (
          <div className="w-64 border-r bg-background flex-shrink-0 overflow-y-auto">
            <div className="p-3">
              <h3 className="text-sm font-semibold mb-2">Sessões Recentes</h3>
              <div className="space-y-1.5">
                {sessions.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Nenhuma sessão ainda.
                  </p>
                )}
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors ${
                      session.id === currentSessionId
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 font-medium'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => loadSession(session.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs">{session.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {session.messageCount} msgs
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Session Title */}
          {currentSession && (
            <div className="px-4 py-1.5 border-b bg-muted/30 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-medium truncate">{currentSession.title}</span>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-3xl mx-auto py-4 space-y-4">
              {messages.length === 0 && !isLoading && (
                <div className="space-y-6 py-8">
                  <div className="text-center space-y-2">
                    <div className="inline-flex p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                      <BookOpen className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold">War Room — Documentação Senior</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Faça perguntas sobre a documentação Senior e receba respostas com fontes,
                      confiança e lacunas identificadas.
                    </p>
                  </div>

                  {/* Suggested Questions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground text-center">
                      Perguntas sugeridas
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(q)}
                          className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-left"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isLoadingSession && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted'
                    }`}
                  >
                    {/* Message Content */}
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Assistant Metadata */}
                    {msg.role === 'assistant' && (
                      <div className="mt-3 space-y-2">
                        {/* Badges Row */}
                        <div className="flex flex-wrap gap-1.5">
                          {msg.confidence && CONFIDENCE_LABELS[msg.confidence] && (
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${CONFIDENCE_LABELS[msg.confidence].color}`}
                            >
                              Confiança: {CONFIDENCE_LABELS[msg.confidence].label}
                            </Badge>
                          )}
                          {msg.intent && INTENT_LABELS[msg.intent] && (
                            <Badge variant="outline" className="text-[10px]">
                              {INTENT_LABELS[msg.intent]}
                            </Badge>
                          )}
                          {msg.product && (
                            <Badge variant="outline" className="text-[10px]">
                              {msg.product}
                            </Badge>
                          )}
                          {msg.module && (
                            <Badge variant="outline" className="text-[10px]">
                              {msg.module}
                            </Badge>
                          )}
                        </div>

                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <Collapsible
                            open={expandedSources[msg.id]}
                            onOpenChange={() => toggleSources(msg.id)}
                          >
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                                <span>
                                  {msg.sources.length} fonte
                                  {msg.sources.length !== 1 ? 's' : ''}
                                </span>
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform ${
                                    expandedSources[msg.id] ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 space-y-2">
                                {msg.sources.map((source) => (
                                  <div
                                    key={source.id}
                                    className="p-2 rounded-md bg-background/60 border text-xs space-y-1"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-medium truncate flex-1">
                                        {source.title}
                                      </p>
                                      <Badge
                                        variant="secondary"
                                        className="text-[9px] flex-shrink-0"
                                      >
                                        {(source.relevance * 100).toFixed(0)}%
                                      </Badge>
                                    </div>
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate"
                                    >
                                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                      <span className="truncate">{source.url}</span>
                                    </a>
                                    {source.snippet && (
                                      <p className="text-muted-foreground line-clamp-2">
                                        {source.snippet}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Gaps - shown when confidence is low */}
                        {msg.confidence === 'low' && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <span>⚠ Lacunas identificadas na documentação</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                    <span className="text-sm text-muted-foreground">
                      Consultando documentação...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t bg-background p-3">
            <div className="max-w-3xl mx-auto flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre a documentação Senior..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

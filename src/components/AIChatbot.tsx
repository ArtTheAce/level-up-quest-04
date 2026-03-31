import { useState, useRef, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const INITIAL_TOKENS = 100_000;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(tasks: any[], timetable: any[]): string {
  const taskList = tasks.length === 0
    ? 'No tasks yet.'
    : tasks.map(t =>
        `- [${t.completed ? 'DONE' : 'TODO'}] "${t.title}" | Subject: ${t.subject || 'N/A'} | Difficulty: ${t.priority} | Deadline: ${t.deadline ? new Date(t.deadline).toLocaleString() : 'None'}`
      ).join('\n');

  const ttList = timetable.length === 0
    ? 'No timetable entries yet.'
    : timetable.map(e => {
        const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        return `- ${days[e.day]}: ${e.subject} ${e.startTime}–${e.endTime}`;
      }).join('\n');

  return `You are Questify AI, an academic assistant built into the Questify student productivity app. You help students manage their academic workload with warmth, calm, and practical focus — like a smart study buddy.

CURRENT USER DATA:
=== TASKS ===
${taskList}

=== TIMETABLE ===
${ttList}

YOUR CAPABILITIES:
- Read and discuss the user's tasks and timetable above
- Suggest priority orders based on deadlines and difficulty
- Help manage academic stress by giving a calm, practical breakdown
- Add, edit, or delete tasks and timetable entries when the user asks

WHEN MAKING CHANGES:
If the user asks you to add/edit/delete a task or timetable entry, you MUST respond with a JSON action block at the END of your message, formatted exactly like this:
<action>
{"type":"ADD_TASK","task":{"title":"...","priority":"easy|medium|hard","subject":"...","deadline":"ISO_STRING_OR_NULL"}}
</action>
OR
<action>
{"type":"DELETE_TASK","taskId":"EXACT_ID_FROM_TASK_LIST"}
</action>
OR
<action>
{"type":"ADD_TIMETABLE","entry":{"subject":"...","day":0,"startTime":"09:00","endTime":"10:00"}}
</action>
OR
<action>
{"type":"DELETE_TIMETABLE","entryId":"EXACT_ID"}
</action>

COUNTER-QUESTIONING: If the user's request is missing required fields, ask for them ONE AT A TIME before executing. For tasks: need title, subject, difficulty, (optionally deadline). For timetable: need subject, day, start time, end time. Only produce the <action> block once you have all required info.

HARD LIMITS — you must NEVER:
- Purchase, apply, or suggest purchasing any shop items
- Grant, deduct, or modify coins or XP
- Activate or deactivate any power-ups or effects
- Discuss anything unrelated to the user's academics, schedule, tasks, or study stress
- Access or modify any other user's data
If asked to do any of these, politely decline: "I can only help with your tasks and timetable — for shop items, head to the Shop page!"

TONE: Calm, warm, encouraging, concise. No corporate speak. Keep responses short and actionable unless the user wants depth.`;
}

export function AIChatbot() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokensRemaining, setTokensRemaining] = useState<number>(INITIAL_TOKENS);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load token count from DB
  useEffect(() => {
    if (!user) return;
    supabase.from('ai_tokens').select('tokens_remaining').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) setTokensRemaining(data.tokens_remaining);
        else {
          // Create initial record
          supabase.from('ai_tokens').insert({ user_id: user.id, tokens_remaining: INITIAL_TOKENS }).then(() => {});
        }
      });
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const parseAndExecuteAction = (content: string) => {
    const match = content.match(/<action>([\s\S]*?)<\/action>/);
    if (!match) return;
    try {
      const action = JSON.parse(match[1].trim());
      if (action.type === 'ADD_TASK') {
        const task = {
          id: crypto.randomUUID(),
          title: action.task.title,
          completed: false,
          priority: action.task.priority || 'medium',
          subject: action.task.subject || undefined,
          subjectColor: undefined,
          deadline: action.task.deadline || undefined,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_TASK', task });
        toast.success(`✅ Task added: "${task.title}"`);
      } else if (action.type === 'DELETE_TASK') {
        dispatch({ type: 'DELETE_TASK', taskId: action.taskId });
        toast.success('🗑️ Task removed');
      } else if (action.type === 'ADD_TIMETABLE') {
        const entry = {
          id: crypto.randomUUID(),
          subject: action.entry.subject,
          subjectColor: '#6366f1' as any,
          day: action.entry.day,
          startTime: action.entry.startTime,
          endTime: action.entry.endTime,
        };
        dispatch({ type: 'ADD_TIMETABLE_ENTRY', entry });
        toast.success(`📅 Timetable updated: ${entry.subject}`);
      } else if (action.type === 'DELETE_TIMETABLE') {
        dispatch({ type: 'DELETE_TIMETABLE_ENTRY', entryId: action.entryId });
        toast.success('📅 Timetable entry removed');
      }
    } catch {
      // malformed action JSON — ignore silently
    }
  };

  const stripAction = (content: string) =>
    content.replace(/<action>[\s\S]*?<\/action>/g, '').trim();

  const sendMessage = async () => {
    if (!input.trim() || loading || tokensRemaining <= 0) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildSystemPrompt(state.tasks, state.timetable),
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const rawContent = data.content?.[0]?.text || 'Sorry, I had trouble responding. Try again!';
      const displayContent = stripAction(rawContent);
      const assistantMsg: Message = { role: 'assistant', content: displayContent };
      setMessages(prev => [...prev, assistantMsg]);

      // Execute any actions
      parseAndExecuteAction(rawContent);

      // Update token count
      const used = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      const newRemaining = Math.max(0, tokensRemaining - used);
      setTokensRemaining(newRemaining);
      if (user) {
        await supabase.from('ai_tokens').update({ tokens_remaining: newRemaining }).eq('user_id', user.id);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong — check your connection and try again.' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const tokenPct = (tokensRemaining / INITIAL_TOKENS) * 100;
  const tokenColour = tokensRemaining < 10_000 ? 'text-red-500' : tokensRemaining < 30_000 ? 'text-amber-500' : 'text-primary';

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
        title="Questify AI Assistant"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x"    initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}><X className="h-6 w-6" /></motion.span>
            : <motion.span key="chat" initial={{ rotate:  90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}><MessageCircle className="h-6 w-6" /></motion.span>
          }
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-24 right-6 z-50 w-[min(400px,calc(100vw-1.5rem))] h-[min(600px,calc(100vh-8rem))] glass-card flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm leading-tight">Questify AI</p>
                <p className="text-xs text-muted-foreground">Academic Assistant</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-bold ${tokenColour}`}>
                  {tokensRemaining.toLocaleString()} tokens
                </p>
                <div className="w-20 h-1 bg-muted rounded-full mt-0.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${tokenPct}%`,
                      backgroundColor: tokensRemaining < 10_000 ? '#ef4444' : tokensRemaining < 30_000 ? '#f59e0b' : 'hsl(var(--primary))',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Disclaimer */}
              {showDisclaimer && (
                <div className="bg-muted/60 rounded-xl p-3 text-xs text-muted-foreground flex gap-2">
                  <span>ℹ️</span>
                  <span>I can help you manage tasks, plan your timetable, and handle academic stress. I can't buy items or change your XP.</span>
                  <button onClick={() => setShowDisclaimer(false)} className="ml-auto shrink-0 hover:text-foreground">✕</button>
                </div>
              )}

              {messages.length === 0 && !showDisclaimer && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <p className="text-2xl mb-2">📚</p>
                  <p>Ask me anything about your tasks, timetable, or study plan!</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tokensRemaining <= 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-500 text-center">
                  You've used all your AI tokens for now. Token refills coming soon.
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Low token warning */}
            {tokensRemaining > 0 && tokensRemaining < 10_000 && (
              <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 text-center shrink-0">
                ⚠️ You're running low on AI tokens — use them wisely!
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  placeholder={tokensRemaining <= 0 ? 'No tokens remaining' : 'Ask me about your tasks or timetable…'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading || tokensRemaining <= 0}
                  rows={1}
                  className="resize-none min-h-[40px] max-h-[120px] text-sm"
                  style={{ fieldSizing: 'content' } as any}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={loading || !input.trim() || tokensRemaining <= 0}
                  className="shrink-0 h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

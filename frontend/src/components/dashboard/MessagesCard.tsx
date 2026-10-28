import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Panel } from './Panel';
import { ChatThread } from '../messages/ChatThread';
import { teamTitle, type Message, type StudentTeam, type TeamArea } from '../../data/staff';
import { cn } from '../../lib/utils';

/** The student's chats: one with their counsellor and one with each officer once assigned, each with its own unread count. */
export function MessagesCard({ studentId, team, messages, initial = 'counsellor' }: { studentId: string; team: StudentTeam; messages: Message[]; initial?: TeamArea }) {
  const chats = (['counsellor', 'finance', 'visa'] as const).filter((k) => team[k]);
  const [open, setOpen] = useState<TeamArea>(chats.includes(initial) ? initial : 'counsellor');
  const unread = (k: TeamArea) => messages.filter((m) => m.studentId === studentId && (m.thread ?? 'counsellor') === k && m.from === 'staff' && !m.readAt).length;
  const person = team[open]!;
  const first = person.name.split(' ')[0];
  const total = chats.reduce((n, k) => n + unread(k), 0);

  return (
    <Panel
      id="messages"
      title="Messages"
      icon={<MessageSquare className="h-4 w-4" aria-hidden />}
      action={total > 0 ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{total} new</span> : undefined}
    >
      {chats.length > 1 && (
        <div className="-mt-1 mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Chats">
          {chats.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={open === k}
              onClick={() => setOpen(k)}
              data-chat={k}
              className={cn(
                'flex shrink-0 flex-col items-start rounded-2xl px-3.5 py-2 text-left transition',
                open === k ? 'bg-navy-900 text-white' : 'bg-white text-navy-700 ring-1 ring-navy-100 hover:bg-navy-50',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {team[k]!.name}
                {unread(k) > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread(k)}</span>}
              </span>
              <span className={cn('text-[11px]', open === k ? 'text-navy-200' : 'text-navy-400')}>{teamTitle[k]}</span>
            </button>
          ))}
        </div>
      )}
      <p className="-mt-2 mb-3 text-xs text-navy-500">
        {person.name} · {teamTitle[open]} · replies within 1 working day
      </p>
      <ChatThread
        key={open}
        studentId={studentId}
        viewer="student"
        thread={open}
        placeholder={`Ask ${first}…`}
        emptyText={
          open === 'counsellor'
            ? `No messages yet. Ask ${first} anything about your plans.`
            : open === 'finance'
              ? `No messages yet. Ask ${first} about scholarships, loans or proof of funds.`
              : `No messages yet. Ask ${first} about your visa, travel or settling in.`
        }
      />
    </Panel>
  );
}

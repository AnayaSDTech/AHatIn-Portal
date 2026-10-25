import { MessageSquare } from 'lucide-react';
import { Panel } from './Panel';
import { ChatThread } from '../messages/ChatThread';
import type { Counsellor } from '../../data/staff';

/** The student's chat with their counsellor. */
export function MessagesCard({ studentId, counsellor, unread }: { studentId: string; counsellor: Counsellor; unread: number }) {
  const first = counsellor.name.split(' ')[0];
  return (
    <Panel
      id="messages"
      title="Messages"
      icon={<MessageSquare className="h-4 w-4" aria-hidden />}
      action={unread > 0 ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{unread} new</span> : undefined}
    >
      <p className="-mt-2 mb-3 text-xs text-navy-500">Chat with {counsellor.name}. Replies usually within one working day.</p>
      <ChatThread studentId={studentId} viewer="student" emptyText={`No messages yet. Ask ${first} anything about your plans.`} />
    </Panel>
  );
}

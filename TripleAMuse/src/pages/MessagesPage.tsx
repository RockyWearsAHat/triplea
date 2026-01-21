import { AppShell, ChatInbox } from "@shared";

export function MessagesPage() {
  return (
    <AppShell
      title="Messages"
      subtitle="Inbox for client support and internal coordination."
    >
      <ChatInbox />
    </AppShell>
  );
}

import { EmailSendingForm } from "@/components/email-sending-form"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Bulk Email Sender</h1>
      <EmailSendingForm />
    </main>
  )
}

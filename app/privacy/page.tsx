import Link from 'next/link'
import { LegalPage, ContactLine, Operator } from '@/components/legal/LegalPage'

export const metadata = { title: 'Privacy — AskPanel' }

// Describes what the code actually does. Update it whenever data handling changes.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        AskPanel is run by <Operator />. This page explains what we collect when you use
        AskPanel, why, who processes it, and how to delete it.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details:</strong> your email address and, if you sign in with Google,
            your name and profile picture. Passwords are handled by Firebase Authentication; we
            never see them.
          </li>
          <li>
            <strong>What you ask and what the panel answers:</strong> your questions, chat
            messages, debate transcripts, verdicts, generated titles, and a running summary of
            long conversations.
          </li>
          <li>
            <strong>Context you add (Pro):</strong> text you paste, the text of web pages you
            give us a link to, and the text extracted from files you upload. We keep the
            extracted text (up to 4,000 characters) with the panel; we don&apos;t keep the
            uploaded file.
          </li>
          <li>
            <strong>Plan and billing status:</strong> your plan, how many free debates and
            replies you have used, and your Stripe customer and subscription IDs, status and
            renewal date. Card details go straight to Stripe and never reach our servers.
          </li>
          <li>
            <strong>Abuse protection:</strong> request counters per account, and for sign-ins a
            one-way hash of your IP address, kept only for the short window the limit applies
            to.
          </li>
          <li>
            <strong>Server logs:</strong> errors and events with your account ID, kept by our
            hosting provider for a limited time to keep the service running.
          </li>
        </ul>
        <p className="mt-2">
          We don&apos;t use advertising or analytics trackers, and we don&apos;t sell your data.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We set one cookie, <code>__session</code>, which keeps you signed in for up to 14 days.
          Firebase Authentication also keeps its sign-in state in your browser&apos;s storage.
          Nothing else.
        </p>
      </section>

      <section>
        <h2>Who processes your data</h2>
        <ul>
          <li>
            <strong>Anthropic</strong> runs the AI models. Your questions, the conversation so far
            and any context you add are sent to Anthropic&apos;s API to generate each reply and
            debate turn. Anthropic processes it under its commercial terms, which don&apos;t allow
            it to train its models on this content.
          </li>
          <li>
            <strong>Google (Firebase and Google Cloud)</strong> hosts the app and stores your
            account and content.
          </li>
          <li><strong>Stripe</strong> handles payments for Pro.</li>
          <li>
            When you give a link as context, we fetch that page from our servers, so the site
            you link to sees a request from us, not from you.
          </li>
        </ul>
      </section>

      <section>
        <h2>Sharing</h2>
        <p>
          Panels started from the dashboard are <strong>public by default</strong>: anyone with
          the link can read the question and the debate. You can make a panel private before
          you start it, and private panels are visible only to you. Debates inside chat
          conversations are always private.
        </p>
      </section>

      <section>
        <h2>How long we keep it, and deleting it</h2>
        <p>
          We keep your content until you delete it. You can delete a panel or a conversation at
          any time, and you can delete your whole account from the{' '}
          <Link href="/account" className="underline underline-offset-4">Account</Link> page.
          Deleting your account cancels any subscription and permanently removes your panels,
          conversations, plan details and sign-in account. Stripe keeps its own payment records,
          as the law requires.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Depending on where you live, you may have the right to access, correct, export or
          delete your data, and to object to how it is used. To ask, contact us at{' '}
          <ContactLine />.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>AskPanel is not meant for children under 16, and we don&apos;t knowingly collect their data.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If we change how we handle your data, we&apos;ll update this page and the date at the top.</p>
      </section>
    </LegalPage>
  )
}

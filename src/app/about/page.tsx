'use client';

import Link from 'next/link';
import { useAuthContext } from '@/components/AuthProvider';

export default function AboutPage() {
  const { loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <nav className="container mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-2xl sm:text-3xl font-bold text-blue-600 truncate min-w-0">
            Money Budget
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <Link href="/pricing" className="px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-700 hover:text-blue-600 transition">
              Pricing
            </Link>
            <Link href="/login" className="px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-700 hover:text-blue-600 transition">
              Sign In
            </Link>
            <Link href="/signup" className="px-4 py-2 sm:px-6 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8 text-center">
            Why I built Money Budget
          </h1>
          <div className="space-y-6 text-gray-700 text-base sm:text-lg leading-relaxed">
            <p>
              For a long time I had no idea where my money was really going. I’d just notice my card balance every couple of weeks when I paid it and think, “Okay, I’m spending this much on the card.” We never really limited ourselves on food. We ate what we wanted and went out when we felt like it.
            </p>
            <p>
              Then at some point I decided I wanted to save. The problem was I had no idea which categories were eating my money or by how much. “I should save more” felt vague and I didn’t know where to start. I knew I needed some kind of budgeting, but: (1) I didn’t want to link my bank and hand over all my data to an app, and (2) I knew I’d never keep up with manually logging every transaction.
            </p>
            <p>
              One day I was looking at my credit card transaction history in my bank app. I checked what was actually on there. The card number was only the last 4 digits, and there wasn’t much else that felt like sensitive personal info. So I thought: if I could give just that history to an AI and have it categorize my spending, that would actually be useful. I built a tool for myself that does exactly that: you upload a PDF of your card or statement, we strip things like account numbers and names before anything goes to the AI, and only the transaction lines (merchant, date, amount) get used for categorization. One upload, no bank linking, no typing in every purchase.
            </p>
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-6 sm:py-8 mt-12">
        <div className="container mx-auto px-4 sm:px-6 text-center text-gray-600 text-sm sm:text-base">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mb-2">
            <Link href="/pricing" className="hover:text-blue-600 transition">Pricing</Link>
            <Link href="/about" className="hover:text-blue-600 transition">About</Link>
            <Link href="/login" className="hover:text-blue-600 transition">Sign In</Link>
            <Link href="/signup" className="hover:text-blue-600 transition">Get Started</Link>
          </div>
          <p>&copy; 2026 Money Budget. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

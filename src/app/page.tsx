'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/components/AuthProvider';

export default function HomePage() {
  const { loading } = useAuthContext();
  const videoRef = useRef<HTMLVideoElement>(null);

  // 데모 비디오 2배속
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setSpeed = () => {
      video.playbackRate = 2;
    };
    video.addEventListener('loadedmetadata', setSpeed);
    video.addEventListener('canplay', setSpeed);
    setSpeed();
    return () => {
      video.removeEventListener('loadedmetadata', setSpeed);
      video.removeEventListener('canplay', setSpeed);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      {/* 네비게이션 */}
      <nav className="container mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xl sm:text-2xl font-bold text-blue-600 truncate min-w-0">
            Money Budget
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <Link
              href="/login"
              className="px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-700 hover:text-blue-600 transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 sm:px-6 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <main className="container mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-4 sm:mb-6">
            No bank links.
            <span className="text-blue-600"> No daily logging.</span>
          </h1>
          <p className="text-base sm:text-xl text-gray-600 mb-8 sm:mb-10 max-w-2xl mx-auto px-0">
            Just upload your credit card history or bank statement PDF once a month. 
            AI categorizes everything—no sharing accounts, no risk to your personal info. 
            Keep your budget with one upload.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 text-white text-base sm:text-lg font-semibold rounded-xl hover:bg-blue-700 transition shadow-lg hover:shadow-xl w-full sm:w-auto text-center"
            >
              Start Free
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 sm:px-8 sm:py-4 bg-white text-gray-700 text-base sm:text-lg font-semibold rounded-xl hover:bg-gray-50 transition shadow-lg border border-gray-200 w-full sm:w-auto text-center"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* 데모 비디오 - 얼마나 간단한지 직접 보여주기 (2배속) */}
        <section className="mt-16 sm:mt-24 max-w-4xl mx-auto px-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 text-center mb-2 sm:mb-3">
            See how simple it is
          </h2>
          <p className="text-sm sm:text-base text-gray-600 text-center mb-6 sm:mb-8 max-w-xl mx-auto px-2">
            Upload PDF → AI categorizes → Review & save. No bank links, no daily logging.
          </p>
          <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-black">
            <video
              ref={videoRef}
              src="/demo.mov"
              controls
              playsInline
              className="w-full aspect-video object-contain"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </section>

        {/* 기능 소개 */}
        <div className="mt-16 sm:mt-32 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          {/* 기능 1 */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              No bank connections
            </h3>
            <p className="text-gray-600">
              Your banks stay disconnected. No linking accounts—no risk to your personal info. 
              You control what you upload.
            </p>
          </div>

          {/* 기능 2 */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Upload PDF, once a month
            </h3>
            <p className="text-gray-600">
              Credit card transaction history or bank statement—just upload the PDF. 
              AI extracts and categorizes everything. No daily logging.
            </p>
          </div>

          {/* 기능 3 */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Easy budget, one upload
            </h3>
            <p className="text-gray-600">
              See where your money went with charts and a calendar. 
              One upload per month is enough to keep your budget in shape.
            </p>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t border-gray-200 py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 text-center text-gray-600 text-sm sm:text-base">
          <p>&copy; 2026 Money Budget. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

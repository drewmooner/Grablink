import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grablink - Save access; always on",
  description: "Save access; always on. Download videos from Instagram, YouTube, Twitter, and more platforms instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress MetaMask connection errors - MUST run IMMEDIATELY
              (function() {
                'use strict';
                // Override console.error BEFORE anything else
                if (typeof window !== 'undefined') {
                  const originalError = window.console.error || function() {};
                  window.console.error = function(...args) {
                    try {
                      const errorString = String(args.join(' ')).toLowerCase();
                      // Filter out all MetaMask-related errors
                      if (errorString.includes('failed to connect to metamask') || 
                          errorString.includes('metamask') && errorString.includes('connect') ||
                          errorString.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
                          errorString.includes('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn') ||
                          errorString.includes('object.connect')) {
                        return; // Suppress completely
                      }
                      originalError.apply(console, args);
                    } catch(e) {
                      originalError.apply(console, args);
                    }
                  };
                  
                  // Override console.warn
                  const originalWarn = window.console.warn || function() {};
                  window.console.warn = function(...args) {
                    try {
                      const warnString = String(args.join(' ')).toLowerCase();
                      if (warnString.includes('metamask') || 
                          warnString.includes('nkbihfbeogaeaoehlefnkodbefgpgknn')) {
                        return;
                      }
                      originalWarn.apply(console, args);
                    } catch(e) {
                      originalWarn.apply(console, args);
                    }
                  };
                  
                  // Catch unhandled promise rejections
                  if (window.addEventListener) {
                    window.addEventListener('unhandledrejection', function(event) {
                      try {
                        const reason = String(event.reason?.message || event.reason || '').toLowerCase();
                        if (reason.includes('metamask') || 
                            reason.includes('failed to connect') ||
                            reason.includes('nkbihfbeogaeaoehlefnkodbefgpgknn')) {
                          event.preventDefault();
                          event.stopPropagation();
                          event.stopImmediatePropagation();
                          return false;
                        }
                      } catch(e) {}
                    }, true);
                    
                    // Catch all errors
                    window.addEventListener('error', function(event) {
                      try {
                        const errorMsg = String(event.message || event.error?.message || '').toLowerCase();
                        const errorSource = String(event.filename || event.source || '').toLowerCase();
                        if (errorMsg.includes('metamask') || 
                            errorMsg.includes('failed to connect') ||
                            errorSource.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
                            errorSource.includes('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn')) {
                          event.preventDefault();
                          event.stopPropagation();
                          event.stopImmediatePropagation();
                          return false;
                        }
                      } catch(e) {}
                    }, true);
                  }
                }
              })();
            `,
          }}
        />
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="5d7c0418-ad3d-43b6-be7e-b3ff326e86b7"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Verify Umami script loaded
              (function() {
                let checkCount = 0;
                const maxChecks = 20; // Check for 2 seconds (20 * 100ms)
                
                const checkUmami = setInterval(function() {
                  checkCount++;
                  if (typeof window !== 'undefined' && window.umami) {
                    console.log('[Umami] Tracking script loaded successfully');
                    clearInterval(checkUmami);
                  } else if (checkCount >= maxChecks) {
                    console.warn('[Umami] Tracking script failed to load after 2 seconds');
                    clearInterval(checkUmami);
                  }
                }, 100);
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              // Additional MetaMask error suppression in body (backup)
              (function() {
                if (typeof window !== 'undefined' && window.console) {
                  const originalError = window.console.error;
                  window.console.error = function(...args) {
                    const errorString = String(args.join(' ')).toLowerCase();
                    if (errorString.includes('failed to connect to metamask') || 
                        errorString.includes('metamask') && errorString.includes('connect') ||
                        errorString.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
                        errorString.includes('object.connect')) {
                      return;
                    }
                    if (originalError) originalError.apply(console, args);
                  };
                }
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}

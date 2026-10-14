import React from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../brand/BrandMark';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY } from '../authCopy';

interface AuthBackLink {
  to: string;
  label: string;
}

interface AuthLayoutProps {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  /** Which portal this is; by default the shared sign-in's. */
  footerLabel?: string;
  /** A way out of the card, shown above the brand, for pages a visitor can land on directly. */
  backLink?: AuthBackLink;
}

/**
 * The shared frame of the sign-in, sign-up, password and first-login pages: one opaque card on the
 * theme's picture.
 *
 * `theme-page-art` lays the picture in the bottom right of the page under a veil that thickens
 * towards the top left, so the card is the only place for text and the picture never has to be
 * read through. From 1024px the card moves to the left and leaves the animals in view; below that
 * it is centred, and on a phone it fills the width with a 16px gutter.
 *
 * The card is solid `surface-card` in every theme. The floating labels in the form fields paint
 * their own background in that colour to cut the field border, so the card must stay opaque.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footerLabel,
  backLink,
}: AuthLayoutProps): React.ReactElement {
  const copy = useSiteCopy(AUTH_COPY);

  return (
    <main className="theme-page-art flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:justify-start lg:px-8">
        <div className="w-full min-w-0 max-w-[480px] rounded-3xl border border-border-soft bg-surface-card shadow-card">
          <div className="px-5 py-8 sm:px-10 sm:py-10">
            {/* The language switch sits on every one of these pages: they are reached from emails
                and links, before the visitor has seen any other page of the site. */}
            <div className="mb-5 flex items-center justify-between gap-3">
              {backLink ? (
                <Link
                  to={backLink.to}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-accent-foreground px-4 py-1.5 type-button text-accent-foreground transition-colors hover:border-accent-foreground-hover hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {backLink.label}
                </Link>
              ) : (
                <span />
              )}
            </div>
            <div className="mb-8 flex flex-col items-start gap-3">
              <h1 className="flex items-center gap-3 type-title font-logo text-brand-title text-theme-earth tracking-tight">
                <BrandMark className="h-10 w-10" />
                Wagstay
              </h1>
              <h2 className="type-display font-agbalumo font-normal">{title}</h2>
              <div className="max-w-full type-body text-notice-secondary [overflow-wrap:anywhere]">
                {subtitle}
              </div>
            </div>

            {children}
          </div>

          {/* Which portal this is, for staff who use more than one. */}
          <div className="flex items-center gap-2 border-t border-border-soft px-5 py-4 sm:px-10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="h-4 w-4 flex-shrink-0 text-theme-earth"
            >
              <path
                fillRule="evenodd"
                d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z"
                clipRule="evenodd"
              />
              <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.56.196-1.15.348-1.764.441Z" />
            </svg>
            <span className="type-eyebrow text-notice-muted">
              {footerLabel ?? copy.layout.footer}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

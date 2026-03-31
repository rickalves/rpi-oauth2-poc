"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="text-gray-500">Choose a provider to continue</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex items-center justify-center gap-2 rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Sign in with Google
        </button>
        <button
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="flex items-center justify-center gap-2 rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Sign in with GitHub
        </button>
      </div>
    </main>
  );
}

import Link from "next/link";
import Header from "@/components/header";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-bold">RPI OAuth2 Demo</h1>
        <p className="text-gray-500 max-w-md text-center">
          A demonstration of OAuth2 authentication with Google and GitHub using
          Auth.js v5 and MongoDB.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </main>
    </>
  );
}

import { auth } from "@/auth";
import Header from "@/components/header";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <>
      <Header />
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-500 mb-4">Welcome, {session?.user?.name}.</p>
        <pre className="bg-gray-800 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(session?.user, null, 2)}
        </pre>
      </main>
    </>
  );
}

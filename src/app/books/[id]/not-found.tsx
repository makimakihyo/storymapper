import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold">本が見つかりません</h1>
      <p className="mt-2 text-gray-600">
        指定された本は存在しないか、アクセス権限がありません。
      </p>
      <p className="mt-4">
        <Link href="/" className="text-blue-600 hover:underline">
          ← ホームへ戻る
        </Link>
      </p>
    </main>
  );
}
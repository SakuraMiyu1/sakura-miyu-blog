import { posts } from '../lib/blog';
export async function GET() {
  const index = (await posts()).map(post => ({ id: post.id, title: post.data.title, description: post.data.description, tags: post.data.tags, category: post.data.category, content: (post.body || '').replace(/<[^>]*>/g, ' ').replace(/[#*_`]/g, '') }));
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

import type { APIContext } from 'astro';
import { feed } from '../lib/feeds';
export async function GET(context: APIContext) { return feed('uk', context.site!); }

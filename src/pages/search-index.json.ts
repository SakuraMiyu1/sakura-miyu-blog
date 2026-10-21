import { searchIndex } from '../lib/feeds';
export async function GET() { return searchIndex('uk'); }

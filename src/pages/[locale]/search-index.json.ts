import type { APIContext } from 'astro';
import { locales, type Locale } from '../../lib/i18n';
import { searchIndex } from '../../lib/feeds';
export function getStaticPaths() { return locales.map(locale => ({ params: { locale } })); }
export async function GET(context: APIContext) { return searchIndex(context.params.locale as Locale); }

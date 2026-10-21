import type { APIContext } from 'astro';
import { locales, type Locale } from '../../lib/i18n';
import { feed } from '../../lib/feeds';
export function getStaticPaths() { return locales.map(locale => ({ params: { locale } })); }
export async function GET(context: APIContext) { return feed(context.params.locale as Locale, context.site!); }
